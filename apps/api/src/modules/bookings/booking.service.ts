import { HttpStatus, Injectable } from '@nestjs/common';
import {
  createHoldResponseSchema,
  paginated,
  bookingListItemSchema,
  type AppliedPromotion,
  type BookingDetail,
  type CreateHoldBody,
  type CreateHoldResponse,
  type DayOfWeek,
  type GridIntervalMinutes,
  type MyBookingsQuery,
  type Paginated,
  type BookingListItem,
  type PeakTimeRange,
  type PriceBreakdown,
  type TimeOfDay,
} from '@repo/types';
import {
  computeHoldExpiry,
  computePriceBreakdown,
  expandToLattice,
  timeToMinutes,
  validateBookingSelection,
  type HoldWindowMinutes,
} from '@repo/domain';
import type { Booking, Payment, Prisma, Promotion } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { CourtsRepository } from '../courts/courts.repository';
import { ConfigRepository } from '../config/config.repository';
import { MembersRepository } from '../members/members.repository';
import { BranchesRepository } from '../branches/branches.repository';
import { SportsRepository } from '../sports/sports.repository';
import { PromotionsRepository } from '../promotions/promotions.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { utcToIctParts, resolveDayOfWeek } from '../availability/ict-time';
import { BookingsRepository } from './bookings.repository';
import { SlotUnavailableError, PromotionCapReachedError } from './errors';
import { mapToBookingDetail, mapToBookingListItem } from './booking.mapper';

/** Non-QR/Pay-Onsite-agnostic subset of a Court's peak ranges, mapped the
 * same way `AvailabilityService` maps them — kept local since it's a tiny
 * Prisma-row → domain-input shape, not worth a shared helper. */
function toPeakTimeRanges(
  peakTimeRanges: { id: string; label: string | null; days: string[]; startTime: string; endTime: string; pricePerGridUnit: number }[],
): PeakTimeRange[] {
  return peakTimeRanges.map((p) => ({
    id: p.id,
    label: p.label,
    days: p.days as unknown as DayOfWeek[],
    startTime: p.startTime as TimeOfDay,
    endTime: p.endTime as TimeOfDay,
    pricePerGridUnit: p.pricePerGridUnit,
  }));
}

/** Statuses a booking must be in for its promo to still be changeable (PRD C4.2) —
 * once a QR slip is uploaded/reviewed or the booking is otherwise terminal/confirmed,
 * the price is locked. */
const PROMO_CHANGEABLE_STATUSES: Booking['status'][] = ['PENDING_VERIFICATION', 'PENDING_PAYMENT'];

/**
 * Booking/Hold lifecycle orchestration (PRD C1.2/C4.2/C4.3, ARCHITECTURE §5/§6).
 * Owns: Hold creation (grid validation + authoritative pricing + promo +
 * verification-state fork), the lazy self-heal on read once OTP completes,
 * promo apply/remove, self-service cancellation requests, and the member's
 * paginated booking history. Never trusts a client-sent price — every price
 * on a Booking is (re)computed here via `@repo/domain`.
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly courts: CourtsRepository,
    private readonly config: ConfigRepository,
    private readonly members: MembersRepository,
    private readonly branches: BranchesRepository,
    private readonly sports: SportsRepository,
    private readonly promotions: PromotionsRepository,
    private readonly audit: AuditLogRepository,
  ) {}

  async createHold(memberId: string, courtId: string, body: CreateHoldBody): Promise<CreateHoldResponse> {
    const court = await this.courts.findById(courtId);
    // Mirror AvailabilityService/CatalogController — never leak an inactive/deleted court.
    if (!court || !court.isActive || court.deletedAt) {
      throw ApiError.notFound('Court not found');
    }

    const [branch, sport, member, config] = await Promise.all([
      this.branches.findById(court.branchId),
      this.sports.findById(court.sportId),
      this.members.findById(memberId),
      this.config.get(),
    ]);
    if (!branch) throw ApiError.notFound('Court not found');
    if (!sport) throw ApiError.notFound('Court not found');
    if (!member) throw ApiError.unauthenticated();
    if (!config) {
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Tenant configuration is missing');
    }
    if (member.isBlocked) {
      throw ApiError.forbidden('This account has been blocked', 'MEMBER_BLOCKED');
    }

    const start = new Date(body.start);
    const { date, minutes: startMinutes } = utcToIctParts(start);
    const dayOfWeek = resolveDayOfWeek(date);
    const entry = court.schedule.find((s) => s.day === dayOfWeek);
    if (!entry || entry.closed || entry.openTime === null || entry.closeTime === null) {
      throw ApiError.conflict('SLOT_UNAVAILABLE', 'Court is closed on the requested day');
    }

    const gridIntervalMinutes = court.gridIntervalMinutes as GridIntervalMinutes;
    const openMinutes = timeToMinutes(entry.openTime as TimeOfDay);
    const closeMinutes = timeToMinutes(entry.closeTime as TimeOfDay);

    const selection = validateBookingSelection({
      openMinutes,
      closeMinutes,
      gridInterval: gridIntervalMinutes,
      maxSlots: court.maxSlots,
      startMinutes,
      slotCount: body.slotCount,
    });
    if (!selection.valid) {
      throw ApiError.validation(`Invalid booking selection (${selection.reason})`, { reason: selection.reason });
    }

    const now = new Date();
    const leadCutoff = new Date(now.getTime() + config.minBookingLeadTimeMinutes * 60_000);
    if (start < leadCutoff) {
      throw ApiError.conflict('SLOT_UNAVAILABLE', 'Start time is inside the minimum booking lead-time window');
    }
    if (config.maxAdvanceBookingDays != null) {
      const advanceCutoff = new Date(now.getTime() + config.maxAdvanceBookingDays * 86_400_000);
      if (start >= advanceCutoff) {
        throw ApiError.conflict('SLOT_UNAVAILABLE', 'Start time is beyond the maximum advance booking window');
      }
    }

    const endsAt = new Date(start.getTime() + body.slotCount * gridIntervalMinutes * 60_000);
    const lockLatticeStarts = expandToLattice(start, body.slotCount, gridIntervalMinutes);

    // Defense-in-depth (the DB partial unique index is the ultimate guard):
    // re-check maintenance blocks + currently-active slots for this exact span.
    const [blocks, activeSlots] = await Promise.all([
      this.courts.listBlocksInRange(courtId, start, endsAt),
      this.bookings.findActiveSlots(courtId, start, endsAt),
    ]);
    if (blocks.some((b) => b.startsAt.getTime() < endsAt.getTime() && start.getTime() < b.endsAt.getTime())) {
      throw ApiError.conflict('SLOT_UNAVAILABLE', 'Court has a maintenance block during the requested span');
    }
    const activeSlotTimes = new Set(activeSlots.map((s) => s.slotStart.getTime()));
    if (lockLatticeStarts.some((d) => activeSlotTimes.has(d.getTime()))) {
      throw ApiError.conflict('SLOT_UNAVAILABLE', 'Requested slot is no longer available');
    }

    const peakTimeRanges = toPeakTimeRanges(court.peakTimeRanges);
    let priceBreakdown: PriceBreakdown = computePriceBreakdown({
      gridIntervalMinutes,
      slotCount: body.slotCount,
      startMinutes,
      day: dayOfWeek,
      basePricePerGridUnit: court.basePricePerGridUnit,
      peakTimeRanges,
    });

    let appliedPromotion: AppliedPromotion | null = null;
    if (body.promoCode) {
      appliedPromotion = await this.resolvePromotion(
        body.promoCode,
        { branchId: court.branchId, sportId: court.sportId, courtId: court.id },
        memberId,
        priceBreakdown.subtotal,
      );
      priceBreakdown = computePriceBreakdown({
        gridIntervalMinutes,
        slotCount: body.slotCount,
        startMinutes,
        day: dayOfWeek,
        basePricePerGridUnit: court.basePricePerGridUnit,
        peakTimeRanges,
        promotion: appliedPromotion,
      });
    }

    const holdExpiresAt = computeHoldExpiry(now, config.holdWindowMinutes as HoldWindowMinutes);

    let booking: Booking;
    try {
      booking = await this.bookings.createHold({
        memberId,
        courtId,
        branchId: court.branchId,
        sportId: court.sportId,
        branchName: branch.name,
        sportName: sport.name,
        courtName: court.name,
        branchPaymentMethod: branch.paymentMethod,
        startsAt: start,
        endsAt,
        gridIntervalMinutes,
        slotCount: body.slotCount,
        verifiedVia: 'SELF_OTP',
        isWalkIn: false,
        priceBreakdown: priceBreakdown as unknown as Prisma.InputJsonValue,
        subtotalAmount: priceBreakdown.subtotal,
        totalAmount: priceBreakdown.total,
        appliedPromotionId: appliedPromotion?.promotionId ?? null,
        promotionDiscountAmount: appliedPromotion?.discountAmount ?? null,
        holdExpiresAt,
        lockLatticeStarts,
      });
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        throw ApiError.conflict('SLOT_UNAVAILABLE', 'This slot was just taken — please choose another');
      }
      throw err;
    }

    await this.audit.record({
      actorType: 'MEMBER',
      actorId: memberId,
      action: 'BOOKING_HOLD_CREATED',
      entityType: 'Booking',
      entityId: booking.id,
      metadata: { courtId, startsAt: start.toISOString(), slotCount: body.slotCount },
    });

    let payment: Payment | null = null;
    let nextStep: CreateHoldResponse['nextStep'];

    if (!member.phoneVerified) {
      nextStep = 'VERIFY_PHONE';
    } else if (branch.paymentMethod === 'QR_CODE') {
      const advanced = await this.bookings.advanceOutOfVerification({
        bookingId: booking.id,
        newStatus: 'PENDING_PAYMENT',
        payment: { status: 'AWAITING_SLIP_UPLOAD', amountDue: priceBreakdown.total },
      });
      booking = advanced.booking;
      payment = advanced.payment;
      nextStep = 'UPLOAD_SLIP';
      await this.audit.record({
        actorType: 'MEMBER',
        actorId: memberId,
        action: 'BOOKING_ADVANCED_PENDING_PAYMENT',
        entityType: 'Booking',
        entityId: booking.id,
      });
    } else {
      let advanced;
      try {
        advanced = await this.bookings.advanceOutOfVerification({
          bookingId: booking.id,
          newStatus: 'CONFIRMED',
          payment: { status: 'PAY_ONSITE_NOT_COLLECTED', amountDue: priceBreakdown.total },
          redeem: appliedPromotion
            ? { promotionId: appliedPromotion.promotionId, memberId, discountAmount: appliedPromotion.discountAmount }
            : undefined,
        });
      } catch (err) {
        if (err instanceof PromotionCapReachedError) {
          // The promo sold out its last use between hold and this synchronous
          // confirm. Release the just-held slots (the advance rolled back, so
          // the booking is still PENDING_VERIFICATION) and tell the member.
          await this.bookings.transitionStatus(booking.id, 'EXPIRED');
          throw ApiError.conflict('PROMO_NOT_APPLICABLE', 'This promo code is no longer available');
        }
        throw err;
      }
      booking = advanced.booking;
      payment = advanced.payment;
      nextStep = 'CONFIRMED';
      await this.audit.record({
        actorType: 'MEMBER',
        actorId: memberId,
        action: 'BOOKING_CONFIRMED',
        entityType: 'Booking',
        entityId: booking.id,
      });
    }

    const detail = mapToBookingDetail(booking, payment, member, {
      now: new Date(),
      cancellationCutoffHours: config.cancellationCutoffHours,
    });

    return createHoldResponseSchema.parse({
      booking: detail,
      branchPaymentMethod: branch.paymentMethod,
      nextStep,
    });
  }

  /**
   * Idempotent lazy self-heal (ARCHITECTURE §5.3 philosophy applied to
   * verification, not just hold expiry): if a booking is still
   * `PENDING_VERIFICATION` and its hold has expired, transition it to
   * `EXPIRED` (releasing slots). Otherwise, if the owning Member has since
   * completed OTP (`phoneVerified` flipped true after the Hold was created),
   * advance it exactly the same way `createHold` would have. No-op for any
   * other status. Called at the top of `getBookingDetail` so a client
   * re-reading a booking after finishing OTP always sees its converged state.
   */
  async advanceAfterVerification(bookingId: string, memberId: string): Promise<void> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking || booking.memberId !== memberId || booking.status !== 'PENDING_VERIFICATION') {
      return;
    }

    const now = new Date();
    if (booking.holdExpiresAt && booking.holdExpiresAt <= now) {
      await this.bookings.transitionStatus(bookingId, 'EXPIRED');
      return;
    }

    const member = await this.members.findById(memberId);
    if (!member || !member.phoneVerified) return;

    if (booking.branchPaymentMethod === 'QR_CODE') {
      await this.bookings.advanceOutOfVerification({
        bookingId,
        newStatus: 'PENDING_PAYMENT',
        payment: { status: 'AWAITING_SLIP_UPLOAD', amountDue: booking.totalAmount },
      });
      await this.audit.record({
        actorType: 'MEMBER',
        actorId: memberId,
        action: 'BOOKING_ADVANCED_PENDING_PAYMENT',
        entityType: 'Booking',
        entityId: bookingId,
      });
    } else {
      const redeem =
        booking.appliedPromotionId && booking.promotionDiscountAmount != null
          ? { promotionId: booking.appliedPromotionId, memberId, discountAmount: booking.promotionDiscountAmount }
          : undefined;
      try {
        await this.bookings.advanceOutOfVerification({
          bookingId,
          newStatus: 'CONFIRMED',
          payment: { status: 'PAY_ONSITE_NOT_COLLECTED', amountDue: booking.totalAmount },
          redeem,
        });
      } catch (err) {
        if (err instanceof PromotionCapReachedError) {
          // Rare: the applied promo exhausted its cap (via OTHER bookings)
          // before this one's deferred confirm. The advance rolled back, so the
          // booking stays PENDING_VERIFICATION and self-heals to EXPIRED once
          // its hold lapses; the member can re-hold without the promo. Nothing
          // to do on this read.
          return;
        }
        throw err;
      }
      await this.audit.record({
        actorType: 'MEMBER',
        actorId: memberId,
        action: 'BOOKING_CONFIRMED',
        entityType: 'Booking',
        entityId: bookingId,
      });
    }
  }

  async getBookingDetail(bookingId: string, memberId: string): Promise<BookingDetail> {
    await this.advanceAfterVerification(bookingId, memberId);

    const record = await this.bookings.findByIdWithPayment(bookingId);
    // Fail closed — no existence leak for another member's booking (mirrors
    // the M4/M5 not-found philosophy).
    if (!record || record.memberId !== memberId) {
      throw ApiError.notFound('Booking not found');
    }

    const config = await this.config.get();
    return mapToBookingDetail(record, record.payment, record.member, {
      now: new Date(),
      cancellationCutoffHours: config?.cancellationCutoffHours ?? 2,
    });
  }

  async applyPromo(bookingId: string, memberId: string, code: string): Promise<BookingDetail> {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record || record.memberId !== memberId) throw ApiError.notFound('Booking not found');
    if (!PROMO_CHANGEABLE_STATUSES.includes(record.status)) {
      throw ApiError.conflict('PROMO_NOT_APPLICABLE', 'Promo codes can only be applied before payment is confirmed');
    }

    // Re-price against the SNAPSHOT the member agreed to at hold time, NOT a
    // re-derivation from live court config — an admin editing base/peak pricing
    // during the hold window must never silently rebase the held booking. The
    // stored breakdown's `subtotal` is the pre-discount base; only the promo
    // discount + total change here.
    const snapshot = record.priceBreakdown as unknown as PriceBreakdown;

    const applied = await this.resolvePromotion(
      code,
      { branchId: record.branchId, sportId: record.sportId, courtId: record.courtId },
      memberId,
      snapshot.subtotal,
    );

    const breakdown: PriceBreakdown = {
      ...snapshot,
      promotion: applied,
      total: Math.max(0, snapshot.subtotal - applied.discountAmount),
    };

    const result = await this.bookings.updatePricing(bookingId, {
      priceBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      subtotalAmount: breakdown.subtotal,
      totalAmount: breakdown.total,
      appliedPromotionId: applied.promotionId,
      promotionDiscountAmount: applied.discountAmount,
    });

    await this.audit.record({
      actorType: 'MEMBER',
      actorId: memberId,
      action: 'PROMO_APPLIED',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { code: applied.code, discountAmount: applied.discountAmount },
    });

    const config = await this.config.get();
    return mapToBookingDetail(result.booking, result.payment, record.member, {
      now: new Date(),
      cancellationCutoffHours: config?.cancellationCutoffHours ?? 2,
    });
  }

  async removePromo(bookingId: string, memberId: string): Promise<BookingDetail> {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record || record.memberId !== memberId) throw ApiError.notFound('Booking not found');
    if (!PROMO_CHANGEABLE_STATUSES.includes(record.status)) {
      throw ApiError.conflict('PROMO_NOT_APPLICABLE', 'Promo codes can only be changed before payment is confirmed');
    }

    // Restore the snapshot's pre-discount total (same snapshot-not-live-config
    // rule as `applyPromo`).
    const snapshot = record.priceBreakdown as unknown as PriceBreakdown;
    const breakdown: PriceBreakdown = { ...snapshot, promotion: null, total: snapshot.subtotal };

    const result = await this.bookings.updatePricing(bookingId, {
      priceBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      subtotalAmount: breakdown.subtotal,
      totalAmount: breakdown.total,
      appliedPromotionId: null,
      promotionDiscountAmount: null,
    });

    await this.audit.record({
      actorType: 'MEMBER',
      actorId: memberId,
      action: 'PROMO_REMOVED',
      entityType: 'Booking',
      entityId: bookingId,
    });

    const config = await this.config.get();
    return mapToBookingDetail(result.booking, result.payment, record.member, {
      now: new Date(),
      cancellationCutoffHours: config?.cancellationCutoffHours ?? 2,
    });
  }

  async requestCancellation(bookingId: string, memberId: string, reason?: string): Promise<BookingDetail> {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record || record.memberId !== memberId) throw ApiError.notFound('Booking not found');

    if (record.status !== 'CONFIRMED') {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'Only a Confirmed booking can have cancellation requested');
    }

    const config = await this.config.get();
    const cancellationCutoffHours = config?.cancellationCutoffHours ?? 2;
    const cutoffInstant = new Date(record.startsAt.getTime() - cancellationCutoffHours * 60 * 60_000);
    const now = new Date();
    if (now >= cutoffInstant) {
      throw ApiError.conflict(
        'CANCELLATION_CUTOFF_PASSED',
        `Cancellation must be requested at least ${cancellationCutoffHours}h before the start time`,
      );
    }

    const booking = await this.bookings.transitionStatus(bookingId, 'CANCELLATION_REQUESTED', {
      cancellationRequestedAt: now,
      cancellationRequestReason: reason ?? null,
    });

    await this.audit.record({
      actorType: 'MEMBER',
      actorId: memberId,
      action: 'CANCELLATION_REQUESTED',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: reason ? { reason } : undefined,
    });

    return mapToBookingDetail(booking, record.payment, record.member, {
      now,
      cancellationCutoffHours,
    });
  }

  async listMyBookings(memberId: string, query: MyBookingsQuery): Promise<Paginated<BookingListItem>> {
    const now = new Date();
    const startsAtGte = query.scope === 'upcoming' ? now : undefined;
    const startsAtLt = query.scope === 'past' ? now : undefined;
    const skip = (query.page - 1) * query.pageSize;

    const [rows, total] = await Promise.all([
      this.bookings.listForMember(memberId, {
        skip,
        take: query.pageSize,
        status: query.status,
        startsAtGte,
        startsAtLt,
      }),
      this.bookings.countForMember(memberId, { status: query.status, startsAtGte, startsAtLt }),
    ]);

    return paginated(bookingListItemSchema).parse({
      items: rows.map(mapToBookingListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNextPage: skip + rows.length < total,
    });
  }

  /**
   * Promo validation (PRD A6/C4.2): code exists for the tenant, active,
   * within its validity window, in-scope for the booking's branch/sport/court
   * (`null` on the Promotion = tenant-wide for that dimension), and under
   * both the total-uses and per-member-uses caps. ANY failure maps to a
   * single `409 PROMO_NOT_APPLICABLE` (message varies, code does not) — the
   * caller decides when to fold the resulting discount into a price
   * breakdown. Redemption itself (`PromotionRedemption` + `totalUses++`) is
   * NEVER performed here — only at the moment a booking reaches CONFIRMED
   * (`advanceOutOfVerification`'s `redeem` argument).
   */
  private async resolvePromotion(
    code: string,
    scope: { branchId: string; sportId: string; courtId: string },
    memberId: string,
    subtotal: number,
  ): Promise<AppliedPromotion> {
    const promo: Promotion | null = await this.promotions.findByCode(code);
    const now = new Date();

    if (
      !promo ||
      !promo.isActive ||
      now < promo.validFrom ||
      now > promo.validUntil ||
      (promo.branchId !== null && promo.branchId !== scope.branchId) ||
      (promo.sportId !== null && promo.sportId !== scope.sportId) ||
      (promo.courtId !== null && promo.courtId !== scope.courtId) ||
      (promo.maxTotalUses !== null && promo.totalUses >= promo.maxTotalUses)
    ) {
      throw ApiError.conflict('PROMO_NOT_APPLICABLE', 'This promo code is not valid for this booking');
    }

    if (promo.maxUsesPerMember !== null) {
      const used = await this.promotions.countUsesByMember(promo.id, memberId);
      if (used >= promo.maxUsesPerMember) {
        throw ApiError.conflict('PROMO_NOT_APPLICABLE', 'This promo code has already been used the maximum number of times');
      }
    }

    const discountAmount =
      promo.discountType === 'PERCENTAGE'
        ? Math.floor((subtotal * promo.discountValue) / 100)
        : Math.min(promo.discountValue, subtotal);

    return {
      promotionId: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount,
    };
  }
}

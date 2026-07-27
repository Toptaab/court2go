import { HttpStatus, Injectable } from '@nestjs/common';
import {
  createHoldResponseSchema,
  paginated,
  bookingListItemSchema,
  type AdminCreateBookingBody,
  type AdminModifyBookingBody,
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

/** Terminal/immutable statuses an admin may not modify (PRD A2.1 AC3). */
const ADMIN_UNMODIFIABLE_STATUSES: Booking['status'][] = ['REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];

type ResolvedMember = NonNullable<Awaited<ReturnType<MembersRepository['findById']>>>;

/** Fully-resolved, validated, priced booking selection — the output of
 * `BookingService.planBookingSelection`, consumed by both `createHold`
 * (member) and `createWalkIn` (admin) before they open the Hold. */
interface BookingSelectionPlan {
  court: NonNullable<Awaited<ReturnType<CourtsRepository['findById']>>>;
  branch: NonNullable<Awaited<ReturnType<BranchesRepository['findById']>>>;
  sport: NonNullable<Awaited<ReturnType<SportsRepository['findById']>>>;
  /** `null` for a brand-new walk-in member the caller persists only after this
   * plan validates (see `createWalkIn`); always set for the member flow. */
  member: ResolvedMember | null;
  config: NonNullable<Awaited<ReturnType<ConfigRepository['get']>>>;
  startsAt: Date;
  endsAt: Date;
  gridIntervalMinutes: GridIntervalMinutes;
  lockLatticeStarts: Date[];
  priceBreakdown: PriceBreakdown;
  appliedPromotion: AppliedPromotion | null;
}

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
    const plan = await this.planBookingSelection(memberId, courtId, {
      start: body.start,
      slotCount: body.slotCount,
      promoCode: body.promoCode,
    });
    const { court, branch, sport, member, config } = plan;
    // The member flow always passes a real id, so `plan.member` is set; guard
    // narrows the now-nullable type (and matches the old not-found → 401).
    if (!member) throw ApiError.unauthenticated();
    const { startsAt: start, endsAt, gridIntervalMinutes, lockLatticeStarts, appliedPromotion } = plan;
    const priceBreakdown = plan.priceBreakdown;

    const now = new Date();
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
   * Staff walk-in booking (PRD A2.2, ARCHITECTURE §6.1) — no OTP, auditable
   * `ADMIN_OVERRIDE`. Resolves or quick-creates the Member (exactly one of
   * `memberId`/`newMemberPhone`, schema-enforced), then runs the SAME
   * authoritative selection/pricing pipeline as `createHold` and confirms
   * per branch payment method:
   *  - Pay-Onsite: → CONFIRMED (`PAY_ONSITE_NOT_COLLECTED`), promo redeemed now.
   *  - QR + `directConfirmPayment`: → PENDING_PAYMENT then admin-confirm →
   *    CONFIRMED (promo redeemed at confirm, per the QR redemption rule).
   *  - QR without direct confirm: left at PENDING_PAYMENT awaiting a slip.
   * Branch-scope is enforced by the caller (`AdminBookingsService`) before this
   * runs. Never trusts a client-sent price.
   */
  async createWalkIn(body: AdminCreateBookingBody, adminId: string): Promise<BookingDetail> {
    // Resolve the member reference WITHOUT persisting a brand-new one yet: an
    // existing member is loaded up front, but a new phone is only validated as
    // free here and created AFTER the selection/pricing plan succeeds (below),
    // so a failed walk-in never leaves an orphan verified Member — which would
    // also lock a retry with the same phone behind DUPLICATE_MEMBER.
    let existing: ResolvedMember | null = null;
    let newMemberPhone: string | null = null;
    if (body.memberId) {
      existing = await this.members.findById(body.memberId);
      if (!existing) throw ApiError.notFound('Member not found');
    } else {
      newMemberPhone = body.newMemberPhone as string;
      const dupe = await this.members.findByPhone(newMemberPhone);
      if (dupe) {
        throw ApiError.conflict('DUPLICATE_MEMBER', 'A member with this phone already exists — select them by id');
      }
    }

    const plan = await this.planBookingSelection(
      existing?.id ?? null,
      body.courtId,
      {
        start: body.start,
        slotCount: body.slotCount,
        promoCode: body.promoCode,
      },
      { skipWindowChecks: true },
    );

    let member: ResolvedMember;
    if (existing) {
      member = existing;
    } else {
      member = await this.members.createWithVerifiedPhone(newMemberPhone as string);
      if (body.newMemberName) {
        member = await this.members.updateProfile(member.id, { name: body.newMemberName });
      }
    }
    const { court, branch, sport, config, appliedPromotion, priceBreakdown } = plan;

    const now = new Date();
    const holdExpiresAt = computeHoldExpiry(now, config.holdWindowMinutes as HoldWindowMinutes);

    let booking: Booking;
    try {
      booking = await this.bookings.createHold({
        memberId: member.id,
        courtId: court.id,
        branchId: court.branchId,
        sportId: court.sportId,
        branchName: branch.name,
        sportName: sport.name,
        courtName: court.name,
        branchPaymentMethod: branch.paymentMethod,
        startsAt: plan.startsAt,
        endsAt: plan.endsAt,
        gridIntervalMinutes: plan.gridIntervalMinutes,
        slotCount: body.slotCount,
        verifiedVia: 'ADMIN_OVERRIDE',
        isWalkIn: true,
        priceBreakdown: priceBreakdown as unknown as Prisma.InputJsonValue,
        subtotalAmount: priceBreakdown.subtotal,
        totalAmount: priceBreakdown.total,
        appliedPromotionId: appliedPromotion?.promotionId ?? null,
        promotionDiscountAmount: appliedPromotion?.discountAmount ?? null,
        holdExpiresAt,
        lockLatticeStarts: plan.lockLatticeStarts,
      });
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        throw ApiError.conflict('SLOT_UNAVAILABLE', 'This slot was just taken — please choose another');
      }
      throw err;
    }

    await this.audit.record({
      actorType: 'ADMIN',
      actorId: adminId,
      action: 'BOOKING_WALKIN_CREATED',
      entityType: 'Booking',
      entityId: booking.id,
      metadata: { courtId: court.id, startsAt: plan.startsAt.toISOString(), slotCount: body.slotCount },
    });

    let payment: Payment;
    try {
      if (branch.paymentMethod === 'QR_CODE') {
        const advanced = await this.bookings.advanceOutOfVerification({
          bookingId: booking.id,
          newStatus: 'PENDING_PAYMENT',
          payment: { status: 'AWAITING_SLIP_UPLOAD', amountDue: priceBreakdown.total },
        });
        booking = advanced.booking;
        payment = advanced.payment;
        if (body.directConfirmPayment) {
          const confirmed = await this.bookings.confirmPayment({ bookingId: booking.id, adminId });
          booking = confirmed.booking;
          payment = confirmed.payment;
          await this.audit.record({
            actorType: 'ADMIN',
            actorId: adminId,
            action: 'PAYMENT_CONFIRMED',
            entityType: 'Booking',
            entityId: booking.id,
          });
        }
      } else {
        const advanced = await this.bookings.advanceOutOfVerification({
          bookingId: booking.id,
          newStatus: 'CONFIRMED',
          payment: { status: 'PAY_ONSITE_NOT_COLLECTED', amountDue: priceBreakdown.total },
          redeem: appliedPromotion
            ? { promotionId: appliedPromotion.promotionId, memberId: member.id, discountAmount: appliedPromotion.discountAmount }
            : undefined,
        });
        booking = advanced.booking;
        payment = advanced.payment;
        await this.audit.record({
          actorType: 'ADMIN',
          actorId: adminId,
          action: 'BOOKING_CONFIRMED',
          entityType: 'Booking',
          entityId: booking.id,
        });
      }
    } catch (err) {
      if (err instanceof PromotionCapReachedError) {
        await this.bookings.transitionStatus(booking.id, 'EXPIRED');
        throw ApiError.conflict('PROMO_NOT_APPLICABLE', 'This promo code is no longer available');
      }
      throw err;
    }

    return mapToBookingDetail(booking, payment, member, {
      now: new Date(),
      cancellationCutoffHours: config.cancellationCutoffHours,
      actor: 'ADMIN',
    });
  }

  /**
   * Admin modify time/court/slotCount (PRD A2.1 AC3, ARCHITECTURE §5.2) —
   * release-old-then-reinsert in ONE transaction (`modifySlots`); 409
   * SLOT_UNAVAILABLE rolls the whole thing back, original untouched. Re-derives
   * the AUTHORITATIVE base price for the new selection; any previously-applied
   * promo is dropped (the modify body carries no promo, and silently re-rating
   * a discounted booking on an admin edit would be worse). Caller has already
   * loaded the booking and enforced branch scope.
   */
  async adminModify(booking: Booking, body: AdminModifyBookingBody, adminId: string): Promise<BookingDetail> {
    if (ADMIN_UNMODIFIABLE_STATUSES.includes(booking.status)) {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'This booking can no longer be modified');
    }

    const newCourtId = body.courtId ?? booking.courtId;
    const plan = await this.planBookingSelection(
      booking.memberId,
      newCourtId,
      {
        start: (body.start ? new Date(body.start) : booking.startsAt).toISOString(),
        slotCount: body.slotCount ?? booking.slotCount,
      },
      { skipLiveSlotCheck: true },
    );

    try {
      await this.bookings.modifySlots({
        bookingId: booking.id,
        newCourtId: plan.court.id,
        newCourtName: plan.court.name,
        newStartsAt: plan.startsAt,
        newEndsAt: plan.endsAt,
        newGridIntervalMinutes: plan.gridIntervalMinutes,
        newSlotCount: body.slotCount ?? booking.slotCount,
        newLockLatticeStarts: plan.lockLatticeStarts,
        newPriceBreakdown: plan.priceBreakdown as unknown as Prisma.InputJsonValue,
        newSubtotalAmount: plan.priceBreakdown.subtotal,
        newTotalAmount: plan.priceBreakdown.total,
      });
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        throw ApiError.conflict('SLOT_UNAVAILABLE', 'The requested new slot is not available');
      }
      throw err;
    }

    // Re-price after modify: `modifySlots` rewrites the Booking's price snapshot
    // but never the Payment row, so always sync `Payment.amountDue` to the new
    // total (a pure time move flips peak/off-peak, so the amount changes even
    // without a court/slot change). Any prior promo is dropped in the same write.
    await this.bookings.updatePricing(booking.id, {
      priceBreakdown: plan.priceBreakdown as unknown as Prisma.InputJsonValue,
      subtotalAmount: plan.priceBreakdown.subtotal,
      totalAmount: plan.priceBreakdown.total,
      appliedPromotionId: null,
      promotionDiscountAmount: null,
    });

    await this.audit.record({
      actorType: 'ADMIN',
      actorId: adminId,
      action: 'BOOKING_MODIFIED',
      entityType: 'Booking',
      entityId: booking.id,
      metadata: {
        courtId: newCourtId,
        startsAt: plan.startsAt.toISOString(),
        slotCount: body.slotCount ?? booking.slotCount,
      },
    });

    const record = await this.bookings.findByIdWithPayment(booking.id);
    if (!record) throw ApiError.notFound('Booking not found');
    return mapToBookingDetail(record, record.payment, record.member, {
      now: new Date(),
      cancellationCutoffHours: plan.config.cancellationCutoffHours,
      actor: 'ADMIN',
    });
  }

  /**
   * The authoritative selection → validation → pricing pipeline shared by the
   * member `createHold` and the admin `createWalkIn`. Resolves + guards the
   * court/branch/sport/member/config, validates the grid selection (incl. the
   * 30-min lattice), enforces lead-time / advance-window, re-checks
   * blocks + live slots (defense-in-depth), computes the AUTHORITATIVE price,
   * and resolves any promo. Throws the same `ApiError`s `createHold` always
   * has. Never opens the Hold itself — the caller does, with its own
   * `verifiedVia`/`isWalkIn`.
   */
  private async planBookingSelection(
    memberId: string | null,
    courtId: string,
    sel: { start: string; slotCount: number; promoCode?: string },
    opts?: { skipLiveSlotCheck?: boolean; skipWindowChecks?: boolean },
  ): Promise<BookingSelectionPlan> {
    const court = await this.courts.findById(courtId);
    // Mirror AvailabilityService/CatalogController — never leak an inactive/deleted court.
    if (!court || !court.isActive || court.deletedAt) {
      throw ApiError.notFound('Court not found');
    }

    const [branch, sport, member, config] = await Promise.all([
      this.branches.findById(court.branchId),
      this.sports.findById(court.sportId),
      // `memberId === null` = a brand-new walk-in member not yet persisted — no
      // row to load, treated as unblocked with zero prior promo uses.
      memberId ? this.members.findById(memberId) : Promise.resolve(null),
      this.config.get(),
    ]);
    if (!branch) throw ApiError.notFound('Court not found');
    if (!sport) throw ApiError.notFound('Court not found');
    if (memberId && !member) throw ApiError.unauthenticated();
    if (!config) {
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Tenant configuration is missing');
    }
    if (member?.isBlocked) {
      throw ApiError.forbidden('This account has been blocked', 'MEMBER_BLOCKED');
    }

    const start = new Date(sel.start);
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
      slotCount: sel.slotCount,
    });
    if (!selection.valid) {
      throw ApiError.validation(`Invalid booking selection (${selection.reason})`, { reason: selection.reason });
    }

    // Lead-time / advance-window guards are self-service policy (PRD C3); a
    // staff walk-in (customer physically at the counter, PRD A2.2) books the
    // current/imminent slot, so the caller opts out via `skipWindowChecks`.
    // Block + live-slot conflict checks below still apply to everyone.
    const now = new Date();
    if (!opts?.skipWindowChecks) {
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
    }

    const endsAt = new Date(start.getTime() + sel.slotCount * gridIntervalMinutes * 60_000);
    const lockLatticeStarts = expandToLattice(start, sel.slotCount, gridIntervalMinutes);

    // Defense-in-depth (the DB partial unique index is the ultimate guard):
    // re-check maintenance blocks always, and — except for an admin modify,
    // whose release-then-reinsert in `modifySlots` would otherwise self-conflict
    // on the booking's OWN currently-active slots — the live occupied slots too.
    const blocks = await this.courts.listBlocksInRange(courtId, start, endsAt);
    if (blocks.some((b) => b.startsAt.getTime() < endsAt.getTime() && start.getTime() < b.endsAt.getTime())) {
      throw ApiError.conflict('SLOT_UNAVAILABLE', 'Court has a maintenance block during the requested span');
    }
    if (!opts?.skipLiveSlotCheck) {
      const activeSlots = await this.bookings.findActiveSlots(courtId, start, endsAt);
      const activeSlotTimes = new Set(activeSlots.map((s) => s.slotStart.getTime()));
      if (lockLatticeStarts.some((d) => activeSlotTimes.has(d.getTime()))) {
        throw ApiError.conflict('SLOT_UNAVAILABLE', 'Requested slot is no longer available');
      }
    }

    const peakTimeRanges = toPeakTimeRanges(court.peakTimeRanges);
    let priceBreakdown: PriceBreakdown = computePriceBreakdown({
      gridIntervalMinutes,
      slotCount: sel.slotCount,
      startMinutes,
      day: dayOfWeek,
      basePricePerGridUnit: court.basePricePerGridUnit,
      peakTimeRanges,
    });

    let appliedPromotion: AppliedPromotion | null = null;
    if (sel.promoCode) {
      appliedPromotion = await this.resolvePromotion(
        sel.promoCode,
        { branchId: court.branchId, sportId: court.sportId, courtId: court.id },
        member?.id ?? null,
        priceBreakdown.subtotal,
      );
      priceBreakdown = computePriceBreakdown({
        gridIntervalMinutes,
        slotCount: sel.slotCount,
        startMinutes,
        day: dayOfWeek,
        basePricePerGridUnit: court.basePricePerGridUnit,
        peakTimeRanges,
        promotion: appliedPromotion,
      });
    }

    return {
      court,
      branch,
      sport,
      member,
      config,
      startsAt: start,
      endsAt,
      gridIntervalMinutes,
      lockLatticeStarts,
      priceBreakdown,
      appliedPromotion,
    };
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
    memberId: string | null,
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

    // A brand-new walk-in member (memberId === null) has zero prior redemptions,
    // so the per-member cap can only bind for an already-persisted member.
    if (promo.maxUsesPerMember !== null && memberId !== null) {
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

import { Injectable } from '@nestjs/common';
import {
  Booking,
  BookingStatus,
  BranchPaymentMethod,
  Payment,
  PaymentStatus,
  Prisma,
  VerifiedVia,
} from '../../generated/prisma/client';
import { PrismaService, TenantPrisma } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';
import { isUniqueConstraintViolation } from '../../prisma/prisma-errors';
import { SlotUnavailableError, PromotionCapReachedError } from './errors';
import { ApiError } from '../../common/api-error';
import { AuditLogRepository } from '../audit/audit-log.repository';

/** Filters shared by the admin booking list + its paired count (M9, PRD A2.1). */
export interface AdminBookingFilters {
  branchId?: string;
  sportId?: string;
  courtId?: string;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  dateFrom?: Date;
  dateTo?: Date;
  memberPhone?: string;
  memberId?: string;
}

/**
 * Everything a caller (BookingService, owned by nestjs-backend) must supply
 * to open a Hold. Pricing (`priceBreakdown`/amounts), the fixed-30-min
 * lattice expansion (`lockLatticeStarts`), and grid/slot-count validation are
 * ALL computed upstream by `packages/domain` — this repository is pure
 * persistence, per ARCHITECTURE §3.1 ("all persistence... owned by
 * apps/api", "pricing calc... owned by packages/domain").
 */
export interface CreateHoldInput {
  memberId: string;
  courtId: string;
  branchId: string;
  sportId: string;
  branchName: string;
  sportName: string;
  courtName: string;
  branchPaymentMethod: BranchPaymentMethod;

  startsAt: Date;
  endsAt: Date;
  gridIntervalMinutes: number;
  slotCount: number;

  verifiedVia: VerifiedVia;
  isWalkIn: boolean;

  /** Server-authoritative price breakdown (packages/types `priceBreakdownSchema`
   * shape), stored verbatim as JSON. */
  priceBreakdown: Prisma.InputJsonValue;
  subtotalAmount: number;
  totalAmount: number;
  appliedPromotionId?: string | null;
  promotionDiscountAmount?: number | null;

  holdExpiresAt: Date;

  /** Every fixed 30-minute lattice instant this booking occupies
   * (ARCHITECTURE §5.1) — `duration ÷ 30` entries, computed by the caller
   * from `startsAt`/`endsAt`, NOT from `gridIntervalMinutes`. */
  lockLatticeStarts: Date[];
}

export interface TransitionResult {
  booking: Booking;
}

const ACTIVE_HOLD_STATUSES: BookingStatus[] = ['PENDING_VERIFICATION', 'PENDING_PAYMENT'];

/** Statuses that must release the booking's active `booking_slot` rows when
 * entered (ARCHITECTURE §5.2 release-path table). CONFIRMED and
 * PENDING_PAYMENT_CONFIRMATION deliberately keep slots active (reserved). */
const RELEASING_STATUSES: BookingStatus[] = ['EXPIRED', 'REJECTED', 'CANCELLED'];

@Injectable()
export class BookingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogRepository,
  ) {}

  /**
   * THE safety-critical write (ADR-0003). One DB transaction:
   *   1. lazy, self-healing sweep of stale holds for THIS court (closes the
   *      gap between "logically expired" and "background sweeper hasn't run
   *      yet" exactly at the point of contention);
   *   2. INSERT booking (status = PENDING_VERIFICATION);
   *   3. INSERT one booking_slot row per lattice unit — a single multi-row
   *      INSERT, so a collision with any one unit rolls back the whole
   *      statement (and therefore the whole transaction, including the
   *      just-inserted booking row) atomically.
   *
   * Throws `SlotUnavailableError` (never a raw Prisma error) if any lattice
   * unit is already actively held — the caller maps this to 409
   * SLOT_UNAVAILABLE. Used identically for client self-service holds and
   * Admin walk-in creation (PRD A2.2 AC4) — one code path, per ADR-0003.
   */
  async createHold(input: CreateHoldInput): Promise<Booking> {
    const tenantId = getTenantId();
    return this.prisma.withTenant(async (tx) => {
      await this.sweepExpiredHoldsForCourt(tx, tenantId, input.courtId);

      const booking = await tx.booking.create({
        data: {
          tenantId,
          memberId: input.memberId,
          courtId: input.courtId,
          branchId: input.branchId,
          sportId: input.sportId,
          branchName: input.branchName,
          sportName: input.sportName,
          courtName: input.courtName,
          branchPaymentMethod: input.branchPaymentMethod,
          status: 'PENDING_VERIFICATION',
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          gridIntervalMinutes: input.gridIntervalMinutes,
          slotCount: input.slotCount,
          verifiedVia: input.verifiedVia,
          isWalkIn: input.isWalkIn,
          priceBreakdown: input.priceBreakdown,
          subtotalAmount: input.subtotalAmount,
          totalAmount: input.totalAmount,
          appliedPromotionId: input.appliedPromotionId ?? null,
          promotionDiscountAmount: input.promotionDiscountAmount ?? null,
          holdExpiresAt: input.holdExpiresAt,
        },
      });

      try {
        await tx.bookingSlot.createMany({
          data: input.lockLatticeStarts.map((slotStart) => ({
            tenantId,
            courtId: input.courtId,
            bookingId: booking.id,
            slotStart,
          })),
        });
      } catch (err) {
        if (isUniqueConstraintViolation(err, ['court_id', 'slot_start'])) {
          throw new SlotUnavailableError(input.courtId, input.startsAt);
        }
        throw err;
      }

      return booking;
    });
  }

  /**
   * Admin "modify" (PRD A2.1 AC3) — release the booking's current active
   * slots and attempt to reserve a new set, in ONE transaction. If the new
   * units aren't free, the unique-index violation rolls back the entire
   * transaction (old release included), leaving the original booking
   * completely untouched (ARCHITECTURE §5.2).
   */
  async modifySlots(args: {
    bookingId: string;
    newCourtId: string;
    newCourtName: string;
    newStartsAt: Date;
    newEndsAt: Date;
    newGridIntervalMinutes: number;
    newSlotCount: number;
    newLockLatticeStarts: Date[];
    newPriceBreakdown: Prisma.InputJsonValue;
    newSubtotalAmount: number;
    newTotalAmount: number;
  }): Promise<Booking> {
    const tenantId = getTenantId();
    return this.prisma.withTenant(async (tx) => {
      await tx.bookingSlot.updateMany({
        where: { bookingId: args.bookingId, releasedAt: null },
        data: { releasedAt: new Date() },
      });

      const booking = await tx.booking.update({
        where: { id: args.bookingId },
        data: {
          courtId: args.newCourtId,
          courtName: args.newCourtName,
          startsAt: args.newStartsAt,
          endsAt: args.newEndsAt,
          gridIntervalMinutes: args.newGridIntervalMinutes,
          slotCount: args.newSlotCount,
          priceBreakdown: args.newPriceBreakdown,
          subtotalAmount: args.newSubtotalAmount,
          totalAmount: args.newTotalAmount,
        },
      });

      try {
        await tx.bookingSlot.createMany({
          data: args.newLockLatticeStarts.map((slotStart) => ({
            tenantId,
            courtId: args.newCourtId,
            bookingId: booking.id,
            slotStart,
          })),
        });
      } catch (err) {
        if (isUniqueConstraintViolation(err, ['court_id', 'slot_start'])) {
          throw new SlotUnavailableError(args.newCourtId, args.newStartsAt);
        }
        throw err;
      }

      return booking;
    });
  }

  /**
   * Generic status transition (verification success, admin cancel, approve a
   * cancellation request, mark completed/no-show). Automatically releases
   * active `booking_slot` rows when transitioning into a status in
   * `RELEASING_STATUSES` (ARCHITECTURE §5.2 table) — the caller does not need
   * to remember to do this separately.
   *
   * NEVER call this with `newStatus: 'CONFIRMED'` — it is a plain,
   * unguarded `booking.update` (no `WHERE status = ...`), so a concurrent
   * caller could silently clobber another transition instead of surfacing a
   * 409. The only writers allowed to set `CONFIRMED` are
   * `advanceOutOfVerification`, `confirmPayment`, and
   * `declineCancellationRequest` (a guarded RESTORE, not a new confirmation)
   * — all three use a status-guarded `updateMany`.
   */
  async transitionStatus(
    bookingId: string,
    newStatus: BookingStatus,
    extra?: Prisma.BookingUpdateInput,
  ): Promise<Booking> {
    return this.prisma.withTenant(async (tx) => {
      if (RELEASING_STATUSES.includes(newStatus)) {
        await tx.bookingSlot.updateMany({
          where: { bookingId, releasedAt: null },
          data: { releasedAt: new Date() },
        });
      }
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: newStatus, ...extra },
      });
    });
  }

  /**
   * The sole write path (with `advanceAfterVerification`'s self-heal call site
   * in `BookingService`) that composes a Booking status transition OUT of
   * `PENDING_VERIFICATION` together with the Payment row it always creates
   * alongside that transition, and (only for the CONFIRMED/Pay-Onsite branch)
   * the Promotion redemption — all inside ONE `withTenant` transaction so
   * booking↔payment↔redemption never diverge (M6 build note: there is no DB
   * convergence trigger for the Confirmed rule — this, together with
   * `confirmPayment`, is the sole code path allowed to set
   * `booking.status = CONFIRMED` as a NEW confirmation, mirroring
   * ARCHITECTURE §6.2. `declineCancellationRequest` also writes `CONFIRMED`,
   * but only as a guarded RESTORE of a booking that was already CONFIRMED
   * before a member's cancellation request — never as a first-time
   * confirmation — so it does not violate this invariant).
   */
  async advanceOutOfVerification(args: {
    bookingId: string;
    newStatus: Extract<BookingStatus, 'PENDING_PAYMENT' | 'CONFIRMED'>;
    payment: { status: PaymentStatus; amountDue: number };
    redeem?: { promotionId: string; memberId: string; discountAmount: number };
  }): Promise<{ booking: Booking; payment: Payment }> {
    const tenantId = getTenantId();
    return this.prisma.withTenant(async (tx) => {
      // Status-guarded advance: only a still-`PENDING_VERIFICATION` booking may
      // transition here. Two concurrent self-heal reads (`advanceAfterVerification`)
      // can both observe the pre-transition state; the guard makes the winner
      // advance and the loser a no-op — otherwise the loser would hit the
      // `Payment.bookingId` / `PromotionRedemption.bookingId` unique constraint
      // and surface a raw 500 on the money path.
      const advanced = await tx.booking.updateMany({
        where: { id: args.bookingId, status: 'PENDING_VERIFICATION' },
        data: { status: args.newStatus },
      });
      if (advanced.count === 0) {
        // Already advanced by a concurrent call — return the converged state.
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: args.bookingId } });
        const payment = await tx.payment.findUniqueOrThrow({ where: { bookingId: args.bookingId } });
        return { booking, payment };
      }

      if (args.redeem) {
        await this.redeemPromotionWithTx(tx, tenantId, {
          promotionId: args.redeem.promotionId,
          bookingId: args.bookingId,
          memberId: args.redeem.memberId,
          discountAmount: args.redeem.discountAmount,
        });
      }

      const booking = await tx.booking.findUniqueOrThrow({ where: { id: args.bookingId } });
      const payment = await tx.payment.create({
        data: {
          tenantId,
          bookingId: args.bookingId,
          status: args.payment.status,
          amountDue: args.payment.amountDue,
        },
      });
      return { booking, payment };
    });
  }

  /**
   * Atomic promotion redemption (M6 build note, ARCHITECTURE §6.2/§9)
   * factored out so BOTH callers that redeem a promo at a booking's moment
   * of Confirmation — `advanceOutOfVerification`'s Pay-Onsite branch (redeem
   * at synchronous auto-confirm) and `confirmPayment`'s QR branch (redeem at
   * admin slip-confirm, NOT at hold time) — share the exact same
   * single-statement conditional-UPDATE cap guard. MUST be called from
   * inside the caller's own `withTenant` transaction (`tx`), after that
   * transaction has already won its status-guarded `updateMany` (so a losing
   * concurrent caller never reaches here at all).
   *
   * Atomic total-cap guard: the single-statement conditional UPDATE closes
   * the read-at-hold / increment-at-confirm TOCTOU — concurrent confirms
   * racing the last use can never push `total_uses` past `max_total_uses`
   * (the row lock serialises the `total_uses < max_total_uses` check).
   * NOTE (carryover for prisma-data): the per-member cap
   * (`max_uses_per_member`) still has NO hard DB backstop — a
   * `(promotion_id, member_id)` partial unique on `promotion_redemption`
   * is the real fix; resolve-time `countUsesByMember` remains best-effort.
   */
  private async redeemPromotionWithTx(
    tx: TenantPrisma,
    tenantId: string,
    redeem: { promotionId: string; bookingId: string; memberId: string; discountAmount: number },
  ): Promise<void> {
    const bumped = await tx.$executeRaw`
      UPDATE "promotion"
         SET "total_uses" = "total_uses" + 1
       WHERE "id" = ${redeem.promotionId}::uuid
         AND ("max_total_uses" IS NULL OR "total_uses" < "max_total_uses")`;
    if (bumped === 0) {
      throw new PromotionCapReachedError(redeem.promotionId);
    }
    await tx.promotionRedemption.create({
      data: {
        tenantId,
        promotionId: redeem.promotionId,
        bookingId: redeem.bookingId,
        memberId: redeem.memberId,
        discountAmount: redeem.discountAmount,
      },
    });
  }

  /**
   * Slip submission (PRD C3.1 AC2, ARCHITECTURE §5.2/§6.1) — the QR-branch
   * counterpart of a status-guarded advance: Booking PENDING_PAYMENT →
   * PENDING_PAYMENT_CONFIRMATION AND Payment AWAITING_SLIP_UPLOAD →
   * SLIP_UPLOADED_PENDING_REVIEW, atomically, in ONE transaction. Grid stays
   * reserved (neither status is in `RELEASING_STATUSES`). Status-guarded via
   * `updateMany` exactly like `advanceOutOfVerification` — a losing
   * concurrent call (e.g. a double-submit) is a no-op that returns the
   * already-converged state rather than a raw constraint error.
   */
  async submitSlip(args: { bookingId: string; slipObjectKey: string }): Promise<{ booking: Booking; payment: Payment }> {
    return this.prisma.withTenant(async (tx) => {
      const advanced = await tx.booking.updateMany({
        where: { id: args.bookingId, status: 'PENDING_PAYMENT' },
        data: { status: 'PENDING_PAYMENT_CONFIRMATION' },
      });
      if (advanced.count === 0) {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: args.bookingId } });
        const payment = await tx.payment.findUniqueOrThrow({ where: { bookingId: args.bookingId } });
        return { booking, payment };
      }

      const slipUpdate = await tx.payment.updateMany({
        where: { bookingId: args.bookingId, status: 'AWAITING_SLIP_UPLOAD' },
        data: {
          status: 'SLIP_UPLOADED_PENDING_REVIEW',
          slipObjectKey: args.slipObjectKey,
          slipUploadedAt: new Date(),
        },
      });
      // Defense-in-depth on the money path: the booking just advanced, so the
      // paired Payment MUST have been AWAITING_SLIP_UPLOAD. If it wasn't, the
      // slip key would never be recorded while the booking silently moved to
      // PENDING_PAYMENT_CONFIRMATION — throw to roll the whole transaction back
      // rather than leave that split state (unreachable given the service-layer
      // `assertPaymentTransition`, but never trust that alone here).
      if (slipUpdate.count === 0) {
        throw new Error(`submitSlip: booking ${args.bookingId} advanced but Payment was not AWAITING_SLIP_UPLOAD`);
      }

      const booking = await tx.booking.findUniqueOrThrow({ where: { id: args.bookingId } });
      const payment = await tx.payment.findUniqueOrThrow({ where: { bookingId: args.bookingId } });
      return { booking, payment };
    });
  }

  /**
   * Admin payment confirm (PRD A2.3 AC2 / A2.2 AC3, ARCHITECTURE §6) — the
   * SOLE additional code path (alongside `advanceOutOfVerification`'s
   * Pay-Onsite branch) allowed to set `booking.status = CONFIRMED` as a NEW
   * confirmation (see `declineCancellationRequest` for the separate guarded
   * RESTORE path, which is not a new confirmation). Covers BOTH: slip review
   * (PENDING_PAYMENT_CONFIRMATION → CONFIRMED) and a direct/walk-in confirm
   * with no slip (PENDING_PAYMENT → CONFIRMED, ARCHITECTURE §6.1 diagram).
   * One `withTenant` transaction:
   *   1. status-guarded Booking update (no-op / converged-state return if
   *      the booking is no longer in a confirmable status — mirrors
   *      `advanceOutOfVerification`'s race handling);
   *   2. IF the booking carries an applied promotion, redeem it HERE (not at
   *      hold time) via the shared `redeemPromotionWithTx` — this is the
   *      QR-branch promo redemption moment (M7 build note: Pay-Onsite redeems
   *      at synchronous auto-confirm in `advanceOutOfVerification`; QR redeems
   *      here, at admin confirm, never earlier);
   *   3. Payment → CONFIRMED with `reviewedByAdminId`/`reviewedAt`/`note`.
   * Grid stays reserved (CONFIRMED is not in `RELEASING_STATUSES`).
   */
  async confirmPayment(args: {
    bookingId: string;
    adminId: string;
    note?: string;
  }): Promise<{ booking: Booking; payment: Payment }> {
    const tenantId = getTenantId();
    return this.prisma.withTenant(async (tx) => {
      const advanced = await tx.booking.updateMany({
        where: { id: args.bookingId, status: { in: ['PENDING_PAYMENT', 'PENDING_PAYMENT_CONFIRMATION'] } },
        data: { status: 'CONFIRMED' },
      });
      if (advanced.count === 0) {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: args.bookingId } });
        const payment = await tx.payment.findUniqueOrThrow({ where: { bookingId: args.bookingId } });
        return { booking, payment };
      }

      const booking = await tx.booking.findUniqueOrThrow({ where: { id: args.bookingId } });

      if (booking.appliedPromotionId && booking.promotionDiscountAmount != null) {
        await this.redeemPromotionWithTx(tx, tenantId, {
          promotionId: booking.appliedPromotionId,
          bookingId: args.bookingId,
          memberId: booking.memberId,
          discountAmount: booking.promotionDiscountAmount,
        });
      }

      const payment = await tx.payment.update({
        where: { bookingId: args.bookingId },
        data: {
          status: 'CONFIRMED',
          reviewedByAdminId: args.adminId,
          reviewedAt: new Date(),
          // A confirm always clears any stale rejection reason. The admin `note`
          // itself is captured on the audit row by the service, not on Payment.
          rejectionReason: null,
        },
      });

      return { booking, payment };
    });
  }

  /**
   * Admin slip reject (PRD A2.3 AC3, ARCHITECTURE §5.2/§6) — Booking
   * PENDING_PAYMENT_CONFIRMATION → REJECTED (releasing the `booking_slot`
   * rows, same as `transitionStatus`'s `RELEASING_STATUSES` handling) AND
   * Payment → REJECTED with `reviewedByAdminId`/`reviewedAt`/`rejectionReason`,
   * atomically in ONE transaction. Status-guarded the same way as
   * `confirmPayment` — a booking no longer in `PENDING_PAYMENT_CONFIRMATION`
   * is a no-op that returns the converged state.
   */
  async rejectPayment(args: {
    bookingId: string;
    adminId: string;
    reason: string;
  }): Promise<{ booking: Booking; payment: Payment }> {
    return this.prisma.withTenant(async (tx) => {
      const advanced = await tx.booking.updateMany({
        where: { id: args.bookingId, status: 'PENDING_PAYMENT_CONFIRMATION' },
        data: { status: 'REJECTED' },
      });
      if (advanced.count === 0) {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: args.bookingId } });
        const payment = await tx.payment.findUniqueOrThrow({ where: { bookingId: args.bookingId } });
        return { booking, payment };
      }

      await tx.bookingSlot.updateMany({
        where: { bookingId: args.bookingId, releasedAt: null },
        data: { releasedAt: new Date() },
      });

      const booking = await tx.booking.findUniqueOrThrow({ where: { id: args.bookingId } });
      const payment = await tx.payment.update({
        where: { bookingId: args.bookingId },
        data: {
          status: 'REJECTED',
          reviewedByAdminId: args.adminId,
          reviewedAt: new Date(),
          rejectionReason: args.reason,
        },
      });

      return { booking, payment };
    });
  }

  /**
   * Admin DECLINE of a cancellation request (PRD A2.1, ARCHITECTURE §6) —
   * restores a `CANCELLATION_REQUESTED` booking back to `CONFIRMED`. This is
   * NOT a new confirmation: it is a guarded RESTORE of a booking that was
   * already `CONFIRMED` before the member's cancellation request moved it to
   * `CANCELLATION_REQUESTED` (slots were never released for that status — it
   * is not in `RELEASING_STATUSES`, so there is nothing to re-reserve).
   *
   * Status-guarded via the same conditional `updateMany` pattern as
   * `confirmPayment`/`rejectPayment`, but — unlike those money-path
   * guards — a losing race here throws `INVALID_STATE_TRANSITION` (409)
   * rather than returning a silently "converged" state: two admins racing
   * APPROVE vs DECLINE on the same cancellation request disagree on the
   * outcome, so there is no safe state to converge to, and the loser must
   * see the conflict. Zero affected rows means the booking is no longer
   * `CANCELLATION_REQUESTED` (already approved/declined concurrently, or
   * moved on some other path) — always a hard error, never a plain
   * `booking.update`/`transitionStatus` call, so a race can never silently
   * clobber another admin's decision. The audit row is written in the SAME
   * transaction via `AuditLogRepository.recordWithTx`, so booking↔audit
   * never diverge.
   */
  async declineCancellationRequest(args: {
    bookingId: string;
    adminId: string;
    reason?: string | null;
  }): Promise<Booking> {
    return this.prisma.withTenant(async (tx) => {
      const restored = await tx.booking.updateMany({
        where: { id: args.bookingId, status: 'CANCELLATION_REQUESTED' },
        data: { status: 'CONFIRMED', cancellationDecisionReason: args.reason ?? null },
      });
      if (restored.count === 0) {
        throw ApiError.conflict('INVALID_STATE_TRANSITION', 'No pending cancellation request on this booking');
      }

      await this.audit.recordWithTx(tx, {
        actorType: 'ADMIN',
        actorId: args.adminId,
        action: 'CANCELLATION_DECLINED',
        entityType: 'Booking',
        entityId: args.bookingId,
        metadata: args.reason ? { reason: args.reason } : undefined,
      });

      return tx.booking.findUniqueOrThrow({ where: { id: args.bookingId } });
    });
  }

  /**
   * Re-price a booking (promo apply/remove, PRD C4.2) — updates the
   * snapshotted `priceBreakdown`/`subtotalAmount`/`totalAmount`/promo fields
   * on the Booking and, if a Payment row already exists (QR branch,
   * PENDING_PAYMENT), keeps `Payment.amountDue` in sync — in ONE transaction.
   */
  async updatePricing(
    bookingId: string,
    data: {
      priceBreakdown: Prisma.InputJsonValue;
      subtotalAmount: number;
      totalAmount: number;
      appliedPromotionId: string | null;
      promotionDiscountAmount: number | null;
    },
  ): Promise<{ booking: Booking; payment: Payment | null }> {
    return this.prisma.withTenant(async (tx) => {
      const booking = await tx.booking.update({ where: { id: bookingId }, data });
      await tx.payment.updateMany({ where: { bookingId }, data: { amountDue: data.totalAmount } });
      const payment = await tx.payment.findUnique({ where: { bookingId } });
      return { booking, payment };
    });
  }

  async findById(id: string): Promise<Booking | null> {
    return this.prisma.withTenant((tx) => tx.booking.findUnique({ where: { id } }));
  }

  async findByIdWithPayment(id: string) {
    return this.prisma.withTenant((tx) =>
      tx.booking.findUnique({ where: { id }, include: { payment: true, member: true } }),
    );
  }

  /** Member booking history (PRD C5.1) — `startsAtGte`/`startsAtLt` implement
   * `MyBookingsQuery.scope` (upcoming/past/all), resolved by the caller from `now`. */
  async listForMember(
    memberId: string,
    opts: {
      skip: number;
      take: number;
      status?: BookingStatus;
      startsAtGte?: Date;
      startsAtLt?: Date;
    },
  ) {
    return this.prisma.withTenant((tx) =>
      tx.booking.findMany({
        where: {
          memberId,
          ...(opts.status ? { status: opts.status } : {}),
          ...(opts.startsAtGte || opts.startsAtLt
            ? {
                startsAt: {
                  ...(opts.startsAtGte ? { gte: opts.startsAtGte } : {}),
                  ...(opts.startsAtLt ? { lt: opts.startsAtLt } : {}),
                },
              }
            : {}),
        },
        include: { payment: true, member: { select: { phone: true, name: true } } },
        orderBy: { startsAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
    );
  }

  /** Paired count for `listForMember`'s pagination envelope. */
  async countForMember(
    memberId: string,
    opts: { status?: BookingStatus; startsAtGte?: Date; startsAtLt?: Date },
  ): Promise<number> {
    return this.prisma.withTenant((tx) =>
      tx.booking.count({
        where: {
          memberId,
          ...(opts.status ? { status: opts.status } : {}),
          ...(opts.startsAtGte || opts.startsAtLt
            ? {
                startsAt: {
                  ...(opts.startsAtGte ? { gte: opts.startsAtGte } : {}),
                  ...(opts.startsAtLt ? { lt: opts.startsAtLt } : {}),
                },
              }
            : {}),
        },
      }),
    );
  }

  /** Shared `where` for the admin booking list/count (PRD A2.1, D2). `paymentStatus`
   * filters the review/refund queues; `memberPhone` is a partial contains match
   * (search box, A2.1 AC2); `memberId` powers the per-member booking history. */
  private adminWhere(filters: AdminBookingFilters): Prisma.BookingWhereInput {
    return {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.sportId ? { sportId: filters.sportId } : {}),
      ...(filters.courtId ? { courtId: filters.courtId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.paymentStatus ? { payment: { status: filters.paymentStatus } } : {}),
      ...(filters.memberId ? { memberId: filters.memberId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            startsAt: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
      ...(filters.memberPhone ? { member: { phone: { contains: filters.memberPhone } } } : {}),
    };
  }

  async listForAdmin(filters: AdminBookingFilters & { skip: number; take: number }) {
    return this.prisma.withTenant((tx) =>
      tx.booking.findMany({
        where: this.adminWhere(filters),
        include: { payment: true, member: true },
        orderBy: { startsAt: 'asc' },
        skip: filters.skip,
        take: filters.take,
      }),
    );
  }

  /** Paired count for `listForAdmin`'s pagination envelope. */
  async countForAdmin(filters: AdminBookingFilters): Promise<number> {
    return this.prisma.withTenant((tx) => tx.booking.count({ where: this.adminWhere(filters) }));
  }

  /** Calendar view (PRD A1) — all bookings for one branch/date, across courts. */
  async listForCalendar(branchId: string, dayStart: Date, dayEnd: Date) {
    return this.prisma.withTenant((tx) =>
      tx.booking.findMany({
        where: { branchId, startsAt: { gte: dayStart, lt: dayEnd } },
        include: { payment: true, member: { select: { phone: true, name: true } } },
        orderBy: [{ courtId: 'asc' }, { startsAt: 'asc' }],
      }),
    );
  }

  /** Active (`released_at IS NULL`) booking_slot rows for a court within a
   * range — the read side of availability computation (never pre-materialized,
   * ARCHITECTURE §5.1). */
  async findActiveSlots(courtId: string, rangeStart: Date, rangeEnd: Date) {
    return this.prisma.withTenant((tx) =>
      tx.bookingSlot.findMany({
        where: {
          courtId,
          releasedAt: null,
          slotStart: { gte: rangeStart, lt: rangeEnd },
        },
        select: { slotStart: true },
      }),
    );
  }

  /**
   * Lazy, self-healing expiry sweep (ADR-0003 §5.3, layer 1) — scoped to one
   * court, run as the FIRST step inside `createHold`'s transaction, before
   * the uniqueness check. Ensures a slot is never incorrectly blocked by a
   * Hold that's logically already expired just because the background
   * sweeper (layer 2, below) hasn't run yet. `EXPIRED` is reachable from
   * `PENDING_VERIFICATION`/`PENDING_PAYMENT` for BOTH branch payment methods
   * (ADR-0006) — no branch-type special-casing here.
   */
  private async sweepExpiredHoldsForCourt(
    tx: TenantPrisma,
    tenantId: string,
    courtId: string,
  ): Promise<void> {
    const stale = await tx.booking.findMany({
      where: {
        courtId,
        status: { in: ACTIVE_HOLD_STATUSES },
        holdExpiresAt: { lt: new Date() },
      },
      select: { id: true },
    });
    if (stale.length === 0) return;

    const staleIds = stale.map((b) => b.id);
    await tx.bookingSlot.updateMany({
      where: { bookingId: { in: staleIds }, releasedAt: null },
      data: { releasedAt: new Date() },
    });
    await tx.booking.updateMany({
      where: { id: { in: staleIds } },
      data: { status: 'EXPIRED' },
    });
  }

  /**
   * Background sweeper (ADR-0003 §5.3, layer 2) — sweeps EVERY tenant/court
   * for stale holds, independent of contention. Called by
   * `apps/api/src/jobs/hold-expiry.job.ts` (`@nestjs/schedule` cron, ~15s;
   * that job also owns the `pg_try_advisory_lock` singleton-worker guard for
   * horizontal scaling — unrelated to, and not a substitute for, this
   * repository's correctness guarantee). Iterates tenants explicitly (via
   * `withExplicitTenant`) rather than a single unscoped query, so RLS still
   * applies to every write — no bypass-RLS connection needed even for this
   * cross-tenant system job.
   */
  async sweepAllExpiredHoldsAcrossTenants(): Promise<number> {
    const tenants = await this.prisma.raw().tenant.findMany({ select: { id: true } });
    let total = 0;
    for (const { id: tenantId } of tenants) {
      total += await this.prisma.withExplicitTenant(tenantId, async (tx) => {
        const stale = await tx.booking.findMany({
          where: { status: { in: ACTIVE_HOLD_STATUSES }, holdExpiresAt: { lt: new Date() } },
          select: { id: true },
        });
        if (stale.length === 0) return 0;
        const staleIds = stale.map((b) => b.id);
        await tx.bookingSlot.updateMany({
          where: { bookingId: { in: staleIds }, releasedAt: null },
          data: { releasedAt: new Date() },
        });
        await tx.booking.updateMany({ where: { id: { in: staleIds } }, data: { status: 'EXPIRED' } });
        return staleIds.length;
      });
    }
    return total;
  }
}

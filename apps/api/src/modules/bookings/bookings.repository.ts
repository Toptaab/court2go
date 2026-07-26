import { Injectable } from '@nestjs/common';
import {
  Booking,
  BookingStatus,
  BranchPaymentMethod,
  Prisma,
  VerifiedVia,
} from '../../generated/prisma/client';
import { PrismaService, TenantPrisma } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';
import { isUniqueConstraintViolation } from '../../prisma/prisma-errors';
import { SlotUnavailableError } from './errors';

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
  constructor(private readonly prisma: PrismaService) {}

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
   * Generic status transition (verification success, admin confirm/reject,
   * cancel, approve/decline cancellation request, mark completed/no-show).
   * Automatically releases active `booking_slot` rows when transitioning
   * into a status in `RELEASING_STATUSES` (ARCHITECTURE §5.2 table) — the
   * caller does not need to remember to do this separately.
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

  async findById(id: string): Promise<Booking | null> {
    return this.prisma.withTenant((tx) => tx.booking.findUnique({ where: { id } }));
  }

  async findByIdWithPayment(id: string) {
    return this.prisma.withTenant((tx) =>
      tx.booking.findUnique({ where: { id }, include: { payment: true, member: true } }),
    );
  }

  async listForMember(memberId: string, opts: { skip: number; take: number; status?: BookingStatus }) {
    return this.prisma.withTenant((tx) =>
      tx.booking.findMany({
        where: { memberId, ...(opts.status ? { status: opts.status } : {}) },
        include: { payment: true },
        orderBy: { startsAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
    );
  }

  async listForAdmin(filters: {
    branchId?: string;
    sportId?: string;
    courtId?: string;
    status?: BookingStatus;
    dateFrom?: Date;
    dateTo?: Date;
    memberPhone?: string;
    skip: number;
    take: number;
  }) {
    return this.prisma.withTenant((tx) =>
      tx.booking.findMany({
        where: {
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          ...(filters.sportId ? { sportId: filters.sportId } : {}),
          ...(filters.courtId ? { courtId: filters.courtId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.dateFrom || filters.dateTo
            ? {
                startsAt: {
                  ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                  ...(filters.dateTo ? { lte: filters.dateTo } : {}),
                },
              }
            : {}),
          ...(filters.memberPhone ? { member: { phone: filters.memberPhone } } : {}),
        },
        include: { payment: true, member: true },
        orderBy: { startsAt: 'asc' },
        skip: filters.skip,
        take: filters.take,
      }),
    );
  }

  /** Calendar view (PRD A1) — all bookings for one branch/date, across courts. */
  async listForCalendar(branchId: string, dayStart: Date, dayEnd: Date) {
    return this.prisma.withTenant((tx) =>
      tx.booking.findMany({
        where: { branchId, startsAt: { gte: dayStart, lt: dayEnd } },
        include: { payment: true },
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

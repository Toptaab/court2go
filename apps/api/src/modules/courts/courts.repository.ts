import { Injectable } from '@nestjs/common';
import { Court, CourtBlock, DayOfWeek } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

export interface ScheduleDayInput {
  day: DayOfWeek;
  closed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface PeakRangeInput {
  label: string | null;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  pricePerGridUnit: number;
}

export interface UpsertCourtInput {
  branchId: string;
  sportId: string;
  name: string;
  gridIntervalMinutes: number;
  maxSlots: number;
  basePricePerGridUnit: number;
  schedule: ScheduleDayInput[];
  peakTimeRanges: PeakRangeInput[];
}

/** Court (PRD §4, A5) — the richest-configured entity. `schedule` and
 * `peakTimeRanges` are owned relations, replaced wholesale on update (the
 * admin form is a full-replace UX, PRD A5.1 AC6/AC7/AC9) inside one
 * transaction so a court is never left with a partial schedule. */
@Injectable()
export class CourtsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.withTenant((tx) =>
      tx.court.findUnique({ where: { id }, include: { schedule: true, peakTimeRanges: true, blocks: true } }),
    );
  }

  /** Public court list for the client flow (PRD C1.1 AC3) — active only. */
  listPublicForBranchAndSport(branchId: string, sportId: string) {
    return this.prisma.withTenant((tx) =>
      tx.court.findMany({
        where: { branchId, sportId, isActive: true, deletedAt: null },
        include: { schedule: true, peakTimeRanges: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  listAdmin(filters: { branchId?: string }) {
    return this.prisma.withTenant((tx) =>
      tx.court.findMany({
        where: filters.branchId ? { branchId: filters.branchId } : {},
        include: { schedule: true, peakTimeRanges: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async create(input: UpsertCourtInput): Promise<Court> {
    const tenantId = getTenantId();
    return this.prisma.withTenant((tx) =>
      tx.court.create({
        data: {
          tenantId,
          branchId: input.branchId,
          sportId: input.sportId,
          name: input.name,
          gridIntervalMinutes: input.gridIntervalMinutes,
          maxSlots: input.maxSlots,
          basePricePerGridUnit: input.basePricePerGridUnit,
          schedule: { create: input.schedule.map((d) => ({ tenantId, ...d })) },
          peakTimeRanges: { create: input.peakTimeRanges.map((p) => ({ tenantId, ...p })) },
        },
      }),
    );
  }

  /**
   * Full-replace update. Changing `gridIntervalMinutes`/`maxSlots` here is
   * safe at any time, even with future bookings, because the lock lattice is
   * fixed at 30 min and independent of this value (ARCHITECTURE §5.4) —
   * existing bookings' `gridIntervalMinutes` snapshot on `Booking` is
   * untouched by this update.
   */
  async update(id: string, input: Omit<UpsertCourtInput, 'branchId' | 'sportId'>): Promise<Court> {
    const tenantId = getTenantId();
    // Already inside withTenant's own transaction (one BEGIN/COMMIT per
    // top-level repository call) — sequential awaits here are part of that
    // SAME transaction; no nested `tx.$transaction` (unsupported on an
    // interactive transaction client, and unnecessary).
    return this.prisma.withTenant(async (tx) => {
      await tx.courtScheduleDay.deleteMany({ where: { courtId: id } });
      await tx.peakTimeRange.deleteMany({ where: { courtId: id } });
      return tx.court.update({
        where: { id },
        data: {
          name: input.name,
          gridIntervalMinutes: input.gridIntervalMinutes,
          maxSlots: input.maxSlots,
          basePricePerGridUnit: input.basePricePerGridUnit,
          schedule: { create: input.schedule.map((d) => ({ tenantId, ...d })) },
          peakTimeRanges: { create: input.peakTimeRanges.map((p) => ({ tenantId, ...p })) },
        },
      });
    });
  }

  setActive(id: string, isActive: boolean): Promise<Court> {
    return this.prisma.withTenant((tx) => tx.court.update({ where: { id }, data: { isActive } }));
  }

  softDelete(id: string): Promise<Court> {
    return this.prisma.withTenant((tx) => tx.court.update({ where: { id }, data: { deletedAt: new Date() } }));
  }

  /** PRD A5.1 AC4 — soft-delete eligibility check, mirrors Branch/Sport. */
  hasFutureBookings(id: string): Promise<boolean> {
    return this.prisma
      .withTenant((tx) =>
        tx.booking.findFirst({
          where: {
            courtId: id,
            startsAt: { gte: new Date() },
            status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] },
          },
          select: { id: true },
        }),
      )
      .then((r) => r !== null);
  }

  /** Maintenance block (PRD A5.1 AC5). */
  createBlock(courtId: string, data: { reason: string | null; startsAt: Date; endsAt: Date }): Promise<CourtBlock> {
    return this.prisma.withTenant((tx) =>
      tx.courtBlock.create({ data: { tenantId: getTenantId(), courtId, ...data } }),
    );
  }

  listBlocksInRange(courtId: string, rangeStart: Date, rangeEnd: Date): Promise<CourtBlock[]> {
    return this.prisma.withTenant((tx) =>
      tx.courtBlock.findMany({
        where: { courtId, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
      }),
    );
  }

  deleteBlock(id: string): Promise<CourtBlock> {
    return this.prisma.withTenant((tx) => tx.courtBlock.delete({ where: { id } }));
  }
}

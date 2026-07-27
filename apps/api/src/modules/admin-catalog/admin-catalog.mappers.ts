import {
  branchSchema,
  sportSchema,
  courtSchema,
  courtBlockSchema,
  lifecycleResultSchema,
  type Branch as BranchDto,
  type Sport as SportDto,
  type Court as CourtDto,
  type CourtBlock as CourtBlockDto,
  type LifecycleResult,
} from '@repo/types';
import type {
  Branch,
  Court,
  CourtBlock,
  CourtScheduleDay,
  PeakTimeRange,
  Sport,
} from '../../generated/prisma/client';

/**
 * Prisma row → FULL admin contract DTO projections (ARCHITECTURE §3.1). Unlike
 * the public mappers these DO expose lifecycle/config columns (isActive,
 * createdAt, promptPayId, businessHours, full schedule/peak ranges) — the admin
 * console is the one audience allowed to see them. Each parses through its
 * schema so contract drift fails loudly.
 */

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export function toAdminBranch(b: Branch): BranchDto {
  return branchSchema.parse({
    id: b.id,
    name: b.name,
    address: b.address,
    paymentMethod: b.paymentMethod,
    promptPayId: b.promptPayId,
    businessHours: b.businessHours,
    isActive: b.isActive,
    createdAt: b.createdAt.toISOString(),
  });
}

export function toAdminSport(s: Sport): SportDto {
  return sportSchema.parse({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
  });
}

export type CourtWithRelations = Court & {
  schedule: CourtScheduleDay[];
  peakTimeRanges: PeakTimeRange[];
};

export function toAdminCourt(c: CourtWithRelations): CourtDto {
  return courtSchema.parse({
    id: c.id,
    branchId: c.branchId,
    sportId: c.sportId,
    name: c.name,
    gridIntervalMinutes: c.gridIntervalMinutes,
    maxSlots: c.maxSlots,
    basePricePerGridUnit: c.basePricePerGridUnit,
    peakTimeRanges: c.peakTimeRanges.map((p) => ({
      id: p.id,
      label: p.label,
      days: p.days,
      startTime: p.startTime,
      endTime: p.endTime,
      pricePerGridUnit: p.pricePerGridUnit,
    })),
    schedule: [...c.schedule]
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
      .map((d) => ({ day: d.day, closed: d.closed, openTime: d.openTime, closeTime: d.closeTime })),
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  });
}

export function toAdminCourtBlock(b: CourtBlock): CourtBlockDto {
  return courtBlockSchema.parse({
    id: b.id,
    courtId: b.courtId,
    reason: b.reason,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
  });
}

/** Deactivate / soft-delete result (PRD A4/A5). */
export function toLifecycleResult(row: { id: string; isActive: boolean; deletedAt: Date | null }): LifecycleResult {
  return lifecycleResultSchema.parse({
    id: row.id,
    isActive: row.isActive,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  });
}

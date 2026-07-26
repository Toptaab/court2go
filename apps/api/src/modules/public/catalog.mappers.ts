import type { Branch, Court, CourtScheduleDay, News, PeakTimeRange, Sport, Tenant } from '../../generated/prisma/client';
import type {
  Branding,
  PublicBranch,
  PublicCourt,
  PublicNews,
  PublicSport,
} from '@repo/types';

/**
 * Prisma row → public contract DTO projections (ARCHITECTURE §3.1: "map Prisma
 * rows → these DTOs before responding"). These are the ONLY shapes the public
 * client ever sees — admin/internal columns (promptPayId, isActive, deletedAt,
 * tenantId, draft news) are dropped here, not filtered downstream.
 */

export function toPublicBranch(b: Branch): PublicBranch {
  return { id: b.id, name: b.name, address: b.address, paymentMethod: b.paymentMethod };
}

export function toPublicSport(s: Sport): PublicSport {
  return { id: s.id, name: s.name };
}

type CourtWithRelations = Court & {
  schedule: CourtScheduleDay[];
  peakTimeRanges: PeakTimeRange[];
};

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export function toPublicCourt(c: CourtWithRelations): PublicCourt {
  return {
    id: c.id,
    branchId: c.branchId,
    sportId: c.sportId,
    name: c.name,
    gridIntervalMinutes: c.gridIntervalMinutes as PublicCourt['gridIntervalMinutes'],
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
    // Contract requires exactly 7 days; sort to a stable Mon..Sun order so the
    // web grid can index by weekday without re-sorting.
    schedule: [...c.schedule]
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
      .map((d) => ({ day: d.day, closed: d.closed, openTime: d.openTime, closeTime: d.closeTime })),
  };
}

export function toPublicNews(n: News): PublicNews {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    imageUrl: n.imageUrl,
    // listPublic()/PUBLISHED guarantees publishedAt is non-null.
    publishedAt: (n.publishedAt ?? n.createdAt).toISOString(),
  };
}

export function toBranding(t: Tenant): Branding {
  return {
    logoUrl: t.logoUrl,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
  };
}

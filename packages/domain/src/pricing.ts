import type {
  AppliedPromotion,
  DayOfWeek,
  GridIntervalMinutes,
  PeakTimeRange,
  PriceBreakdown,
  PricedGridUnit,
  ThbAmount,
} from '@repo/types';
import { minutesToTime, timeToMinutes } from './grid';

/**
 * True if a grid unit starting at `startMinutes` on `day` falls inside any peak
 * range (PRD A5.1 AC9): the unit's START ∈ `[range.startTime, range.endTime)`
 * (half-open — a unit starting exactly at `endTime` is NOT peak) AND `day` is one
 * of `range.days`. Peak ranges are assumed non-overlapping per day (server-validated
 * upstream); the first match found is used.
 */
export function isPeakAtStart(
  startMinutes: number,
  day: DayOfWeek,
  peakTimeRanges: PeakTimeRange[],
): boolean {
  return peakTimeRanges.some((range) => matchesPeakRange(startMinutes, day, range));
}

function matchesPeakRange(startMinutes: number, day: DayOfWeek, range: PeakTimeRange): boolean {
  if (!range.days.includes(day)) return false;
  const rangeStart = timeToMinutes(range.startTime);
  const rangeEnd = timeToMinutes(range.endTime);
  return startMinutes >= rangeStart && startMinutes < rangeEnd;
}

/**
 * Find the first peak range (if any) whose window covers a grid unit starting
 * at `startMinutes` on `day` — used to source that unit's override price.
 */
export function peakRangeAtStart(
  startMinutes: number,
  day: DayOfWeek,
  peakTimeRanges: PeakTimeRange[],
): PeakTimeRange | null {
  return peakTimeRanges.find((range) => matchesPeakRange(startMinutes, day, range)) ?? null;
}

/**
 * Price (THB satang) for ONE grid unit starting at `startMinutes` on `day`:
 * the matching peak range's `pricePerGridUnit` if the unit's start falls in a
 * peak window, else the court's `basePricePerGridUnit` (PRD A5.1 AC9/AC10).
 */
export function priceForGridUnit(
  startMinutes: number,
  day: DayOfWeek,
  basePricePerGridUnit: ThbAmount,
  peakTimeRanges: PeakTimeRange[],
): ThbAmount {
  const peak = peakRangeAtStart(startMinutes, day, peakTimeRanges);
  return peak ? peak.pricePerGridUnit : basePricePerGridUnit;
}

/**
 * Alias kept for callers that think in terms of "the peak price applicable at
 * this start" rather than "the resolved price for this unit" (same resolution
 * as `priceForGridUnit`, but returns `null` when the unit is not peak).
 */
export function peakPriceAtStart(
  startMinutes: number,
  day: DayOfWeek,
  peakTimeRanges: PeakTimeRange[],
): ThbAmount | null {
  return peakRangeAtStart(startMinutes, day, peakTimeRanges)?.pricePerGridUnit ?? null;
}

/**
 * Build the server-authoritative price breakdown for a booking (PRD A5.1 AC10;
 * ARCHITECTURE §7). Mixed peak/base pricing is the SUM of per-grid-unit prices:
 * each of the `slotCount` occupied grid units is priced independently by
 * whichever range (if any) its own start falls into. `promotion`, if supplied,
 * is a pre-computed `AppliedPromotion` snapshot (discount math itself is NOT
 * domain's concern — the caller/promotions module resolves eligibility and
 * `discountAmount`); this function only subtracts it from the subtotal, clamped
 * to a non-negative total. The result satisfies `priceBreakdownSchema`.
 *
 * Assumes a pre-validated selection: `slotCount >= 1` and `startMinutes` on the
 * court grid (run `validateBookingSelection` first). Given `slotCount < 1` it would
 * return an empty `units` array, which is not a valid `PriceBreakdown` — callers
 * must not skip validation.
 */
export function computePriceBreakdown(input: {
  gridIntervalMinutes: GridIntervalMinutes;
  slotCount: number;
  startMinutes: number;
  day: DayOfWeek;
  basePricePerGridUnit: ThbAmount;
  peakTimeRanges: PeakTimeRange[];
  promotion?: AppliedPromotion | null;
}): PriceBreakdown {
  const {
    gridIntervalMinutes,
    slotCount,
    startMinutes,
    day,
    basePricePerGridUnit,
    peakTimeRanges,
    promotion = null,
  } = input;

  const units: PricedGridUnit[] = [];
  for (let index = 0; index < slotCount; index++) {
    const unitStartMinutes = startMinutes + index * gridIntervalMinutes;
    const isPeak = isPeakAtStart(unitStartMinutes, day, peakTimeRanges);
    const unitPrice = priceForGridUnit(
      unitStartMinutes,
      day,
      basePricePerGridUnit,
      peakTimeRanges,
    );
    units.push({
      index,
      startTime: minutesToTime(unitStartMinutes),
      isPeak,
      unitPrice,
    });
  }

  const subtotal = units.reduce((sum, u) => sum + u.unitPrice, 0);
  const discountAmount = promotion?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discountAmount);

  return {
    currency: 'THB',
    gridIntervalMinutes,
    slotCount,
    units,
    subtotal,
    promotion,
    total,
  };
}

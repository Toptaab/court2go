import type { GridIntervalMinutes, TimeOfDay } from '@repo/types';

/**
 * Fixed 30-min lock lattice granularity (ARCHITECTURE §5.1, §9.1). Every court
 * gridInterval ∈ {30,60,90,120} is a multiple of this, so any booking decomposes
 * cleanly into whole lattice units. This is a DIFFERENT granularity from a
 * court's gridInterval (presentation/pricing) — keep them distinct downstream.
 */
export const LATTICE_MINUTES = 30;

/**
 * Convert a wall-clock `HH:MM` time-of-day into minutes-since-midnight.
 * "24:00" (permitted by `timeOfDaySchema` to express end-of-day close) maps to 1440.
 */
export function timeToMinutes(t: TimeOfDay): number {
  const [hh, mm] = t.split(':');
  return Number(hh) * 60 + Number(mm);
}

/**
 * Convert minutes-since-midnight back into a wall-clock `HH:MM` time-of-day.
 * `m === 1440` renders as "24:00" (the one case `timeOfDaySchema` permits outside
 * the normal 00:00–23:59 range).
 */
export function minutesToTime(m: number): TimeOfDay {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * True if `startMinutes` sits on the court's start-time grid for that day: the
 * offset from `openMinutes` is a non-negative whole multiple of `gridInterval`
 * (PRD A5.1 AC1; ARCHITECTURE §5.1). The grid is anchored to the court's
 * `openTime`, not to midnight.
 */
export function isGridAligned(
  startMinutes: number,
  openMinutes: number,
  gridInterval: GridIntervalMinutes,
): boolean {
  const offset = startMinutes - openMinutes;
  return offset >= 0 && offset % gridInterval === 0;
}

/**
 * Every grid start (minutes-since-midnight) between open and close where a
 * single 1-slot booking still fits — i.e. `start + gridInterval <= closeMinutes`
 * (PRD C1.2). Anchored to `openMinutes`.
 */
export function gridStartMinutes(
  openMinutes: number,
  closeMinutes: number,
  gridInterval: GridIntervalMinutes,
): number[] {
  const starts: number[] = [];
  for (let start = openMinutes; start + gridInterval <= closeMinutes; start += gridInterval) {
    starts.push(start);
  }
  return starts;
}

/**
 * Largest contiguous slot count bookable from `startMinutes`, bounded by BOTH
 * the court's `maxSlots` and the closing time (PRD C1.2 AC1/AC2). Returns 0 if
 * even a single slot does not fit before close.
 */
export function maxSlotsFromStart(
  startMinutes: number,
  closeMinutes: number,
  gridInterval: GridIntervalMinutes,
  maxSlots: number,
): number {
  const roomForSlots = Math.floor((closeMinutes - startMinutes) / gridInterval);
  if (roomForSlots <= 0) return 0;
  return Math.min(roomForSlots, maxSlots);
}

/**
 * Number of 30-min lock-lattice units a booking occupies:
 * `slotCount × (gridInterval / 30)` (ARCHITECTURE §5.1, §9.1; gcd(30,60,90,120)=30
 * guarantees this is always a whole number).
 */
export function latticeUnitsForBooking(
  slotCount: number,
  gridInterval: GridIntervalMinutes,
): number {
  return slotCount * (gridInterval / LATTICE_MINUTES);
}

/**
 * Expand a booking into its individual 30-min lock-lattice instants, starting
 * at `startsAt` (inclusive) and stepping forward by `LATTICE_MINUTES` for each
 * of `latticeUnitsForBooking(slotCount, gridInterval)` rows. Does not mutate
 * `startsAt`; returns new `Date` instances.
 */
export function expandToLattice(
  startsAt: Date,
  slotCount: number,
  gridInterval: GridIntervalMinutes,
): Date[] {
  const unitCount = latticeUnitsForBooking(slotCount, gridInterval);
  const rows: Date[] = [];
  for (let i = 0; i < unitCount; i++) {
    rows.push(new Date(startsAt.getTime() + i * LATTICE_MINUTES * 60_000));
  }
  return rows;
}

/** Reasons `validateBookingSelection` may reject a candidate start+slotCount. */
export type BookingSelectionInvalidReason =
  | 'NOT_ALIGNED'
  | 'SLOT_COUNT_OUT_OF_RANGE'
  | 'BEFORE_OPEN'
  | 'OFF_LATTICE'
  | 'EXCEEDS_CLOSING';

export type BookingSelectionResult =
  | { valid: true }
  | { valid: false; reason: BookingSelectionInvalidReason };

/**
 * Validate a candidate (start, slotCount) selection against a court's grid for
 * one day, independent of live occupancy (PRD A5.1 AC1/AC10). Checks, in order:
 * slotCount is an integer in `1..maxSlots`; start is not before open; start is
 * grid-aligned; start sits on the platform-wide 30-min lock lattice; and the
 * booking's end does not exceed close.
 *
 * The `OFF_LATTICE` check is authoritative defense-in-depth for the double-booking
 * guarantee (ARCHITECTURE §5.1/§5.4): the grid is anchored to the court's
 * `openTime`, but `booking_slot.slot_start` lives on the fixed :00/:30 lattice.
 * A court whose `openTime` is not itself 30-min-aligned (e.g. 08:15 — permitted by
 * `timeOfDaySchema`) would place every `expandToLattice` instant off that lattice,
 * so an on-lattice and an off-lattice booking could overlap in real time yet share
 * no `(court_id, slot_start)` pair — a silent double-book. Rejecting off-lattice
 * starts here closes that gap; the root cause (an unconstrained `openTime`) should
 * additionally be fixed at the schema level before M6 consumes this.
 */
export function validateBookingSelection(input: {
  openMinutes: number;
  closeMinutes: number;
  gridInterval: GridIntervalMinutes;
  maxSlots: number;
  startMinutes: number;
  slotCount: number;
}): BookingSelectionResult {
  const { openMinutes, closeMinutes, gridInterval, maxSlots, startMinutes, slotCount } = input;

  if (!Number.isInteger(slotCount) || slotCount < 1 || slotCount > maxSlots) {
    return { valid: false, reason: 'SLOT_COUNT_OUT_OF_RANGE' };
  }
  if (startMinutes < openMinutes) {
    return { valid: false, reason: 'BEFORE_OPEN' };
  }
  if (!isGridAligned(startMinutes, openMinutes, gridInterval)) {
    return { valid: false, reason: 'NOT_ALIGNED' };
  }
  if (startMinutes % LATTICE_MINUTES !== 0) {
    return { valid: false, reason: 'OFF_LATTICE' };
  }
  if (startMinutes + slotCount * gridInterval > closeMinutes) {
    return { valid: false, reason: 'EXCEEDS_CLOSING' };
  }
  return { valid: true };
}

import {
  expandToLattice,
  gridStartMinutes,
  maxSlotsFromStart,
  minutesToTime,
  priceForGridUnit,
  timeToMinutes,
  validateBookingSelection,
  LATTICE_MINUTES,
} from '@repo/domain';
import type {
  AvailabilityResponse,
  AvailabilityStart,
  DayOfWeek,
  GridIntervalMinutes,
  IsoDate,
  PeakTimeRange,
  ThbAmount,
  TimeOfDay,
} from '@repo/types';
import { bangkokLocalToUtc } from './bangkok-time';

/** Plain (DB-free) court config the builder needs for one day's grid. */
export interface AvailabilityCourtConfig {
  courtId: string;
  gridIntervalMinutes: GridIntervalMinutes;
  maxSlots: number;
  basePricePerGridUnit: ThbAmount;
  peakTimeRanges: PeakTimeRange[];
}

/** That day's resolved schedule (already picked from `court.schedule` by weekday). */
export interface AvailabilityDaySchedule {
  day: DayOfWeek;
  closed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface BuildAvailabilityInput {
  court: AvailabilityCourtConfig;
  date: IsoDate;
  daySchedule: AvailabilityDaySchedule;
  /** Epoch-ms of every 30-min lock-lattice instant currently occupied (active
   * booking_slot rows + block-expanded instants), within the day's window. */
  takenLattice: Set<number>;
  /** Injected so past-start exclusion (PRD C1.3) is deterministic/testable. */
  now: Date;
}

/**
 * Expand a set of maintenance blocks into the individual 30-min lock-lattice
 * instants they cover (clamped to `[rangeStart, rangeEnd)`), as epoch-ms.
 * Pure — no DB, so it's unit-testable directly alongside the builder.
 */
export function expandBlocksToLattice(
  blocks: { startsAt: Date; endsAt: Date }[],
  rangeStart: Date,
  rangeEnd: Date,
): Set<number> {
  const out = new Set<number>();
  const stepMs = LATTICE_MINUTES * 60_000;
  for (const block of blocks) {
    const rawStart = block.startsAt.getTime() < rangeStart.getTime() ? rangeStart.getTime() : block.startsAt.getTime();
    const clampedEnd = block.endsAt.getTime() > rangeEnd.getTime() ? rangeEnd.getTime() : block.endsAt.getTime();
    // Snap the start DOWN to the 30-min lock lattice before stepping. A block
    // whose startsAt is off the lattice (e.g. 08:15) would otherwise generate
    // off-lattice epoch-ms that never intersect the always-aligned candidate
    // instants, silently marking nothing taken (latent double-book path once
    // block creation lands — M6). Bangkok is a fixed +07:00 (420min, a multiple
    // of 30), and epoch 0 falls on a lattice instant, so every lattice instant
    // is an integer multiple of stepMs — floor(rawStart / stepMs) * stepMs is
    // exactly the lattice cell the block start falls within. Flooring is the
    // conservative choice: any block overlapping a cell marks the whole cell
    // taken, so a slot overlapping maintenance is never bookable.
    const clampedStart = Math.floor(rawStart / stepMs) * stepMs;
    for (let t = clampedStart; t < clampedEnd; t += stepMs) {
      out.add(t);
    }
  }
  return out;
}

/** Union of active-slot instants + block-expanded instants — the full taken set. */
export function buildTakenLatticeSet(
  activeSlotStarts: Date[],
  blocks: { startsAt: Date; endsAt: Date }[],
  rangeStart: Date,
  rangeEnd: Date,
): Set<number> {
  const taken = expandBlocksToLattice(blocks, rangeStart, rangeEnd);
  for (const slot of activeSlotStarts) {
    taken.add(slot.getTime());
  }
  return taken;
}

/**
 * Resolve a day's open/close strings to the bookable window in minutes, or
 * `null` when the day yields no grid: closed, missing times, or a non-positive
 * window (`closeTime <= openTime` — a misconfigured schedule, e.g. open "22:00"
 * / close "08:00"). Single source of truth shared by the service (to derive the
 * DB query range) and the builder (to derive the grid) so the two parses can't
 * drift, and the sole guard that an inverted window degrades to a `closed`
 * response rather than a silent empty grid.
 */
export function resolveScheduleWindow(
  daySchedule: AvailabilityDaySchedule,
): { openMinutes: number; closeMinutes: number } | null {
  if (daySchedule.closed || daySchedule.openTime === null || daySchedule.closeTime === null) {
    return null;
  }
  const openMinutes = timeToMinutes(daySchedule.openTime as TimeOfDay);
  const closeMinutes = timeToMinutes(daySchedule.closeTime as TimeOfDay);
  if (closeMinutes <= openMinutes) {
    return null;
  }
  return { openMinutes, closeMinutes };
}

/**
 * Pure availability grid builder (PRD C1.2). No I/O, no `Date.now()` — `now`
 * is always supplied by the caller. Degrades gracefully (never throws) for a
 * misconfigured court whose `openTime` is off the 30-min lock lattice
 * (`validateBookingSelection` -> `OFF_LATTICE`): that start is emitted with
 * `maxSlotCount: 0` rather than rejecting the whole day.
 */
export function buildAvailability(input: BuildAvailabilityInput): AvailabilityResponse {
  const { court, date, daySchedule, takenLattice, now } = input;
  const { gridIntervalMinutes, maxSlots, basePricePerGridUnit, peakTimeRanges } = court;

  const window = resolveScheduleWindow(daySchedule);
  if (window === null) {
    return {
      courtId: court.courtId,
      date,
      gridIntervalMinutes,
      maxSlots,
      closed: true,
      starts: [],
    };
  }

  const { openMinutes, closeMinutes } = window;
  const unitsPerSlot = gridIntervalMinutes / LATTICE_MINUTES;

  const starts: AvailabilityStart[] = gridStartMinutes(openMinutes, closeMinutes, gridIntervalMinutes).map(
    (startMinutes) => {
      const startsAt = bangkokLocalToUtc(date, startMinutes);

      // Defensive: an on-grid start that is nonetheless off the platform-wide
      // 30-min lock lattice (a misconfigured openTime, e.g. "08:15" — see
      // packages/domain grid.ts OFF_LATTICE doc). Degrade to unselectable
      // rather than throw (TODO carried flag: constrain openTime at schema
      // level so this can never actually happen — see M6 lattice note).
      const validation = validateBookingSelection({
        openMinutes,
        closeMinutes,
        gridInterval: gridIntervalMinutes,
        maxSlots,
        startMinutes,
        slotCount: 1,
      });
      if (!validation.valid) {
        return { startTime: minutesToTime(startMinutes), startsAt: startsAt.toISOString(), maxSlotCount: 0, pricePerSlotCount: [] };
      }

      // A start strictly in the past is never selectable, regardless of
      // occupancy (PRD C1.3). TODO(M6): Config.minBookingLeadTimeMinutes
      // lead-time cutoff is enforced authoritatively at hold-creation time,
      // not here — this endpoint only excludes starts already in the past.
      if (startsAt.getTime() < now.getTime()) {
        return { startTime: minutesToTime(startMinutes), startsAt: startsAt.toISOString(), maxSlotCount: 0, pricePerSlotCount: [] };
      }

      const cap = maxSlotsFromStart(startMinutes, closeMinutes, gridIntervalMinutes, maxSlots);
      let maxSlotCount = 0;
      if (cap > 0) {
        const fullLattice = expandToLattice(startsAt, cap, gridIntervalMinutes);
        let firstTakenIndex = fullLattice.length;
        for (let i = 0; i < fullLattice.length; i++) {
          if (takenLattice.has(fullLattice[i].getTime())) {
            firstTakenIndex = i;
            break;
          }
        }
        maxSlotCount = Math.floor(firstTakenIndex / unitsPerSlot);
      }

      // Price(N) is the SUM of the first N grid units' prices (computePriceBreakdown
      // semantics with no promotion — total === subtotal). Accumulate incrementally
      // — add just the next grid unit each step — so this is O(maxSlotCount) rather
      // than recomputing the whole breakdown per slotCount (was O(maxSlotCount^2)).
      const pricePerSlotCount: ThbAmount[] = [];
      let runningTotal = 0;
      for (let slotCount = 1; slotCount <= maxSlotCount; slotCount++) {
        const unitStartMinutes = startMinutes + (slotCount - 1) * gridIntervalMinutes;
        runningTotal += priceForGridUnit(unitStartMinutes, daySchedule.day, basePricePerGridUnit, peakTimeRanges);
        pricePerSlotCount.push(runningTotal);
      }

      return {
        startTime: minutesToTime(startMinutes),
        startsAt: startsAt.toISOString(),
        maxSlotCount,
        pricePerSlotCount,
      };
    },
  );

  return {
    courtId: court.courtId,
    date,
    gridIntervalMinutes,
    maxSlots,
    closed: false,
    starts,
  };
}

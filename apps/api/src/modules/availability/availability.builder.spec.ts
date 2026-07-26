import { availabilityResponseSchema, type PeakTimeRange } from '@repo/types';
import {
  buildAvailability,
  buildTakenLatticeSet,
  expandBlocksToLattice,
  type AvailabilityCourtConfig,
  type AvailabilityDaySchedule,
} from './availability.builder';
import { bangkokDayOfWeek, bangkokLocalToUtc } from './bangkok-time';

// Arbitrary future weekday; the actual weekday name doesn't matter since we
// derive it once and reuse it consistently for the schedule day + peak ranges.
const DATE = '2026-08-03';
const DAY = bangkokDayOfWeek(DATE);
const FAR_PAST = new Date('2020-01-01T00:00:00.000Z');

function court(overrides: Partial<AvailabilityCourtConfig> = {}): AvailabilityCourtConfig {
  return {
    courtId: '11111111-1111-4111-8111-111111111111',
    gridIntervalMinutes: 60,
    maxSlots: 4,
    basePricePerGridUnit: 100,
    peakTimeRanges: [],
    ...overrides,
  };
}

function openDay(openTime: string, closeTime: string): AvailabilityDaySchedule {
  return { day: DAY, closed: false, openTime, closeTime };
}

describe('buildAvailability — free grid', () => {
  it('every candidate start is present with maxSlotCount = min(maxSlots, slots-until-close) and correctly-sized pricing', () => {
    const response = buildAvailability({
      court: court({ gridIntervalMinutes: 60, maxSlots: 4, basePricePerGridUnit: 100 }),
      date: DATE,
      daySchedule: openDay('08:00', '22:00'),
      takenLattice: new Set(),
      now: FAR_PAST,
    });

    expect(response.closed).toBe(false);
    // open 08:00(480)..close 22:00(1320), 60-min grid -> starts 480,540,...,1260 (14 starts)
    expect(response.starts).toHaveLength(14);

    const first = response.starts[0];
    expect(first.startTime).toBe('08:00');
    expect(first.maxSlotCount).toBe(4);
    expect(first.pricePerSlotCount).toEqual([100, 200, 300, 400]);

    const last = response.starts[response.starts.length - 1];
    expect(last.startTime).toBe('21:00');
    expect(last.maxSlotCount).toBe(1);
    expect(last.pricePerSlotCount).toEqual([100]);

    expect(() => availabilityResponseSchema.parse(response)).not.toThrow();
  });
});

describe('buildAvailability — an active slot creates a hole', () => {
  it('caps earlier starts run and zeroes the taken start itself', () => {
    const takenAt600 = bangkokLocalToUtc(DATE, 600).getTime(); // 10:00 local
    const response = buildAvailability({
      court: court({ gridIntervalMinutes: 60, maxSlots: 4, basePricePerGridUnit: 100 }),
      date: DATE,
      daySchedule: openDay('08:00', '22:00'),
      takenLattice: new Set([takenAt600]),
      now: FAR_PAST,
    });

    const byStart = Object.fromEntries(response.starts.map((s) => [s.startTime, s]));
    // 08:00 run: units 08:00,08:30(slot1) 09:00,09:30(slot2) 10:00(HOLE) -> 2 full slots fit
    expect(byStart['08:00'].maxSlotCount).toBe(2);
    // 09:00 run: units 09:00,09:30(slot1) 10:00(HOLE) -> only 1 slot fits
    expect(byStart['09:00'].maxSlotCount).toBe(1);
    // 10:00 itself is the taken instant -> zeroed
    expect(byStart['10:00'].maxSlotCount).toBe(0);
    expect(byStart['10:00'].pricePerSlotCount).toEqual([]);
  });
});

describe('buildAvailability — a block subtracts availability', () => {
  it('produces the same capping effect as an active slot, via block expansion', () => {
    const rangeStart = bangkokLocalToUtc(DATE, 480);
    const rangeEnd = bangkokLocalToUtc(DATE, 1320);
    // Block covers 10:00-11:00 local.
    const block = { startsAt: bangkokLocalToUtc(DATE, 600), endsAt: bangkokLocalToUtc(DATE, 660) };
    const takenLattice = buildTakenLatticeSet([], [block], rangeStart, rangeEnd);

    // The block expands to exactly the 10:00 and 10:30 lattice instants.
    expect(takenLattice.has(bangkokLocalToUtc(DATE, 600).getTime())).toBe(true);
    expect(takenLattice.has(bangkokLocalToUtc(DATE, 630).getTime())).toBe(true);
    expect(takenLattice.has(bangkokLocalToUtc(DATE, 660).getTime())).toBe(false);

    const response = buildAvailability({
      court: court({ gridIntervalMinutes: 60, maxSlots: 4, basePricePerGridUnit: 100 }),
      date: DATE,
      daySchedule: openDay('08:00', '22:00'),
      takenLattice,
      now: FAR_PAST,
    });
    const byStart = Object.fromEntries(response.starts.map((s) => [s.startTime, s]));
    expect(byStart['08:00'].maxSlotCount).toBe(2);
    expect(byStart['09:00'].maxSlotCount).toBe(1);
    expect(byStart['10:00'].maxSlotCount).toBe(0);
  });
});

describe('expandBlocksToLattice', () => {
  it('clamps a block to the query window', () => {
    const rangeStart = bangkokLocalToUtc(DATE, 480);
    const rangeEnd = bangkokLocalToUtc(DATE, 600);
    // Block starts before the window and ends after it.
    const block = { startsAt: bangkokLocalToUtc(DATE, 0), endsAt: bangkokLocalToUtc(DATE, 1440) };
    const taken = expandBlocksToLattice([block], rangeStart, rangeEnd);
    expect(taken.has(rangeStart.getTime())).toBe(true);
    expect(taken.has(rangeEnd.getTime())).toBe(false); // exclusive upper bound
  });

  it('snaps an off-lattice block start DOWN to the 30-min lattice cell it falls within', () => {
    const rangeStart = bangkokLocalToUtc(DATE, 0);
    const rangeEnd = bangkokLocalToUtc(DATE, 1440);
    // 08:15 -> 09:15, neither end on the :00/:30 lattice.
    const block = { startsAt: bangkokLocalToUtc(DATE, 495), endsAt: bangkokLocalToUtc(DATE, 555) };
    const taken = expandBlocksToLattice([block], rangeStart, rangeEnd);
    // 08:00 cell (start snapped down) and 08:30 cell (t < 09:15) are taken.
    expect(taken.has(bangkokLocalToUtc(DATE, 480).getTime())).toBe(true);
    expect(taken.has(bangkokLocalToUtc(DATE, 510).getTime())).toBe(true);
    // 07:30 (before the block) and 09:00 (t=540 < 555, still covered)…
    expect(taken.has(bangkokLocalToUtc(DATE, 450).getTime())).toBe(false);
    expect(taken.has(bangkokLocalToUtc(DATE, 540).getTime())).toBe(true);
    // 09:30 is past the block end.
    expect(taken.has(bangkokLocalToUtc(DATE, 570).getTime())).toBe(false);
  });
});

describe('buildAvailability — peak pricing', () => {
  it('sums base + peak per grid unit, exact satang', () => {
    const peak: PeakTimeRange = {
      id: '22222222-2222-4222-8222-222222222222',
      label: 'Evening peak',
      days: [DAY],
      startTime: '08:30',
      endTime: '10:00',
      pricePerGridUnit: 100,
    };
    const response = buildAvailability({
      court: court({ gridIntervalMinutes: 30, maxSlots: 3, basePricePerGridUnit: 50, peakTimeRanges: [peak] }),
      date: DATE,
      daySchedule: openDay('08:00', '10:00'),
      takenLattice: new Set(),
      now: FAR_PAST,
    });
    const start0800 = response.starts.find((s) => s.startTime === '08:00');
    expect(start0800?.maxSlotCount).toBe(3);
    // slot1: unit 08:00 (base) = 50
    // slot2: + unit 08:30 (peak) = 50 + 100 = 150
    // slot3: + unit 09:00 (peak) = 150 + 100 = 250
    expect(start0800?.pricePerSlotCount).toEqual([50, 150, 250]);
  });
});

describe('buildAvailability — closed day', () => {
  it('returns closed: true and an empty starts array', () => {
    const response = buildAvailability({
      court: court(),
      date: DATE,
      daySchedule: { day: DAY, closed: true, openTime: null, closeTime: null },
      takenLattice: new Set(),
      now: FAR_PAST,
    });
    expect(response).toEqual({
      courtId: court().courtId,
      date: DATE,
      gridIntervalMinutes: 60,
      maxSlots: 4,
      closed: true,
      starts: [],
    });
    expect(() => availabilityResponseSchema.parse(response)).not.toThrow();
  });

  it('treats a misconfigured inverted window (closeTime <= openTime) as closed, not an empty open day', () => {
    const response = buildAvailability({
      court: court(),
      date: DATE,
      daySchedule: openDay('22:00', '08:00'), // close before open
      takenLattice: new Set(),
      now: FAR_PAST,
    });
    expect(response.closed).toBe(true);
    expect(response.starts).toEqual([]);
    expect(() => availabilityResponseSchema.parse(response)).not.toThrow();
  });
});

describe('buildAvailability — past starts', () => {
  it('zeroes out starts strictly before `now`, leaving later starts intact', () => {
    const now = bangkokLocalToUtc(DATE, 600); // 10:00 local
    const response = buildAvailability({
      court: court({ gridIntervalMinutes: 60, maxSlots: 2, basePricePerGridUnit: 100 }),
      date: DATE,
      daySchedule: openDay('08:00', '12:00'),
      takenLattice: new Set(),
      now,
    });
    const byStart = Object.fromEntries(response.starts.map((s) => [s.startTime, s]));
    expect(byStart['08:00'].maxSlotCount).toBe(0);
    expect(byStart['08:00'].pricePerSlotCount).toEqual([]);
    expect(byStart['09:00'].maxSlotCount).toBe(0);
    // exactly `now` is NOT in the past -> proceeds normally
    expect(byStart['10:00'].maxSlotCount).toBe(2);
  });
});

describe('buildAvailability — off-lattice openTime degrades gracefully', () => {
  it('every start is OFF_LATTICE -> maxSlotCount 0, no throw', () => {
    const response = buildAvailability({
      court: court({ gridIntervalMinutes: 30, maxSlots: 2, basePricePerGridUnit: 100 }),
      date: DATE,
      daySchedule: openDay('08:15', '10:00'),
      takenLattice: new Set(),
      now: FAR_PAST,
    });
    expect(response.starts.length).toBeGreaterThan(0);
    for (const start of response.starts) {
      expect(start.maxSlotCount).toBe(0);
      expect(start.pricePerSlotCount).toEqual([]);
    }
    expect(() => availabilityResponseSchema.parse(response)).not.toThrow();
  });
});

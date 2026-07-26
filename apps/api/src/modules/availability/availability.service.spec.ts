import { ApiError } from '../../common/api-error';
import type { CourtsRepository } from '../courts/courts.repository';
import type { BookingsRepository } from '../bookings/bookings.repository';
import type { ConfigRepository } from '../config/config.repository';
import { AvailabilityService } from './availability.service';

/**
 * Unit coverage for the availability grid computation (PRD C1.1/C1.2) — the
 * seam where court schedule, live occupancy (bookings + maintenance blocks),
 * tenant Config windows (lead time / advance booking) and pricing
 * (`@repo/domain` computePriceBreakdown, exercised for real — not mocked)
 * all combine into the per-start grid. Repositories are fully mocked; no DB.
 *
 * Thailand-only MVP fixed ICT (UTC+7) offset (PRD NFR9, mirrors the service's
 * own `ictLocalToUtc`), duplicated here ONLY to build UTC fixture instants —
 * the conversion itself is exercised (not re-implemented) via the `startsAt`
 * assertions below.
 */
const ICT_OFFSET_MINUTES = 420;
function ict(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - ICT_OFFSET_MINUTES * 60_000);
}

const COURT_ID = '00000000-0000-4000-8000-000000000001';
/** A Monday (verified: WEEKDAY_BY_JS_DAY[Date.UTC(2026,0,5).getUTCDay()] === 'MON'). */
const DATE = '2026-01-05';

function makeCourt(over: Record<string, unknown> = {}): any {
  return {
    id: COURT_ID,
    isActive: true,
    deletedAt: null as Date | null,
    gridIntervalMinutes: 60,
    maxSlots: 3,
    basePricePerGridUnit: 10_000,
    schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '10:00' }],
    peakTimeRanges: [] as unknown[],
    ...over,
  };
}

function makeConfig(over: Record<string, unknown> = {}): any {
  return {
    minBookingLeadTimeMinutes: 0,
    // Generous by default so lead/advance windows don't interfere unless a
    // test is specifically targeting them (PRD C1.2 AC2/AC3).
    maxAdvanceBookingDays: 3650,
    ...over,
  };
}

function build() {
  const courts = {
    findById: jest.fn(),
    listBlocksInRange: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<CourtsRepository>;

  const bookings = {
    findActiveSlots: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<BookingsRepository>;

  const config = {
    get: jest.fn().mockResolvedValue(makeConfig()),
  } as unknown as jest.Mocked<ConfigRepository>;

  const service = new AvailabilityService(courts, bookings, config);
  return { service, courts, bookings, config };
}

describe('AvailabilityService.computeAvailability', () => {
  beforeEach(() => {
    // Baseline "now" well before every fixture date below, so the default
    // generous Config never trips the lead-time/advance-window guards
    // unless a test deliberately moves the clock (PRD C1.2 AC2/AC3).
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('court lookup (PRD C1.1)', () => {
    it('throws notFound for an unknown court', async () => {
      const { service, courts } = build();
      courts.findById.mockResolvedValue(null);
      await expect(service.computeAvailability(COURT_ID, DATE)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws notFound for an inactive court (never leaked)', async () => {
      const { service, courts } = build();
      courts.findById.mockResolvedValue(makeCourt({ isActive: false }));
      await expect(service.computeAvailability(COURT_ID, DATE)).rejects.toBeInstanceOf(ApiError);
      await expect(service.computeAvailability(COURT_ID, DATE)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws notFound for a soft-deleted court (never leaked)', async () => {
      const { service, courts } = build();
      courts.findById.mockResolvedValue(makeCourt({ deletedAt: new Date('2026-01-01') }));
      await expect(service.computeAvailability(COURT_ID, DATE)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('closed day', () => {
    it('returns closed=true with empty starts when the schedule entry is explicitly closed', async () => {
      const { service, courts } = build();
      courts.findById.mockResolvedValue(
        makeCourt({
          gridIntervalMinutes: 60,
          maxSlots: 3,
          schedule: [{ day: 'MON', closed: true, openTime: null, closeTime: null }],
        }),
      );

      const res = await service.computeAvailability(COURT_ID, DATE);

      expect(res).toEqual({
        courtId: COURT_ID,
        date: DATE,
        gridIntervalMinutes: 60,
        maxSlots: 3,
        closed: true,
        starts: [],
      });
    });

    it('returns closed=true when there is no schedule entry at all for the queried weekday', async () => {
      const { service, courts } = build();
      courts.findById.mockResolvedValue(makeCourt({ schedule: [] }));

      const res = await service.computeAvailability(COURT_ID, DATE);

      expect(res.closed).toBe(true);
      expect(res.starts).toEqual([]);
    });
  });

  describe('open day, no occupancy, no config bounds (PRD C1.2 AC1)', () => {
    it('produces one start per grid slot, bounded by maxSlots and closing time', async () => {
      const { service, courts } = build();
      // 08:00-10:00, 60-min grid, maxSlots 3 -> starts at 08:00 (room for 2) and 09:00 (room for 1).
      courts.findById.mockResolvedValue(
        makeCourt({
          gridIntervalMinutes: 60,
          maxSlots: 3,
          basePricePerGridUnit: 10_000,
          schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '10:00' }],
        }),
      );

      const res = await service.computeAvailability(COURT_ID, DATE);

      expect(res.closed).toBe(false);
      expect(res.starts).toHaveLength(2);

      const [first, second] = res.starts;
      expect(first.startTime).toBe('08:00');
      expect(first.startsAt).toBe('2026-01-05T01:00:00.000Z'); // 08:00 ICT === 01:00Z
      expect(first.maxSlotCount).toBe(2);
      expect(first.pricePerSlotCount).toHaveLength(2);

      expect(second.startTime).toBe('09:00');
      expect(second.maxSlotCount).toBe(1);
      expect(second.pricePerSlotCount).toHaveLength(1);
    });
  });

  describe('occupancy contiguity (PRD C1.2 AC4)', () => {
    it('caps maxSlotCount at the next occupied lattice unit and leaves later starts unaffected', async () => {
      const { service, courts, bookings } = build();
      // 08:00-11:00, 60-min grid, maxSlots 3 -> starts at 08:00, 09:00, 10:00.
      courts.findById.mockResolvedValue(
        makeCourt({
          gridIntervalMinutes: 60,
          maxSlots: 3,
          schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '11:00' }],
        }),
      );
      // Active booking occupying 09:00-10:00 local => lattice units 09:00 and 09:30.
      bookings.findActiveSlots.mockResolvedValue([
        { slotStart: ict(DATE, '09:00') } as any,
        { slotStart: ict(DATE, '09:30') } as any,
      ]);

      const res = await service.computeAvailability(COURT_ID, DATE);

      expect(res.starts.map((s) => s.startTime)).toEqual(['08:00', '09:00', '10:00']);
      // 08:00 could theoretically hold 3 slots, but the 2nd slot would cross
      // into the occupied 09:00 unit -> capped at 1.
      expect(res.starts[0].maxSlotCount).toBe(1);
      // 09:00 itself is occupied -> not selectable at all.
      expect(res.starts[1].maxSlotCount).toBe(0);
      // 10:00 is past the occupied range -> unaffected (theoretical max = 1).
      expect(res.starts[2].maxSlotCount).toBe(1);
    });
  });

  describe('maintenance block', () => {
    it('caps maxSlotCount at a maintenance block and leaves starts after it unaffected', async () => {
      const { service, courts } = build();
      courts.findById.mockResolvedValue(
        makeCourt({
          gridIntervalMinutes: 60,
          maxSlots: 3,
          schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '11:00' }],
        }),
      );
      courts.listBlocksInRange.mockResolvedValue([
        { startsAt: ict(DATE, '09:30'), endsAt: ict(DATE, '10:00') } as any,
      ]);

      const res = await service.computeAvailability(COURT_ID, DATE);

      expect(res.starts.map((s) => s.startTime)).toEqual(['08:00', '09:00', '10:00']);
      // 08:00 would reach the blocked 09:30 unit on its 2nd slot -> capped at 1.
      expect(res.starts[0].maxSlotCount).toBe(1);
      // 09:00's very first slot (09:00-10:00) crosses the blocked 09:30 unit -> 0.
      expect(res.starts[1].maxSlotCount).toBe(0);
      // 10:00 starts exactly where the block ends (half-open) -> unaffected.
      expect(res.starts[2].maxSlotCount).toBe(1);
    });
  });

  describe('lead time (PRD C1.2 AC2)', () => {
    it('zeroes out starts that fall inside the minimum lead-time window', async () => {
      const { service, courts, config } = build();
      courts.findById.mockResolvedValue(
        makeCourt({
          gridIntervalMinutes: 60,
          maxSlots: 1,
          schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '11:00' }],
        }),
      );
      config.get.mockResolvedValue(makeConfig({ minBookingLeadTimeMinutes: 90 }));
      // "Now" = 08:00 local -> lead cutoff = 09:30 local.
      jest.setSystemTime(ict(DATE, '08:00'));

      const res = await service.computeAvailability(COURT_ID, DATE);

      expect(res.starts.map((s) => s.startTime)).toEqual(['08:00', '09:00', '10:00']);
      expect(res.starts[0].maxSlotCount).toBe(0); // inside lead window
      expect(res.starts[1].maxSlotCount).toBe(0); // inside lead window
      expect(res.starts[2].maxSlotCount).toBe(1); // at/after cutoff -> unaffected
    });
  });

  describe('advance window (PRD C1.2 AC3)', () => {
    it('zeroes out every start once the queried date is beyond maxAdvanceBookingDays', async () => {
      const { service, courts, config } = build();
      courts.findById.mockResolvedValue(
        makeCourt({
          gridIntervalMinutes: 60,
          maxSlots: 3,
          schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '10:00' }],
        }),
      );
      config.get.mockResolvedValue(makeConfig({ minBookingLeadTimeMinutes: 0, maxAdvanceBookingDays: 2 }));
      // "Now" = 2026-01-01T00:00Z -> advance cutoff = 2026-01-03T00:00Z, well
      // before the queried 2026-01-05 date.
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const res = await service.computeAvailability(COURT_ID, DATE);

      expect(res.starts).toHaveLength(2);
      for (const start of res.starts) {
        expect(start.maxSlotCount).toBe(0);
        expect(start.pricePerSlotCount).toEqual([]);
      }
    });
  });

  describe('pricing preview (PRD A5.1 AC9/AC10)', () => {
    it('sums base + peak per-grid-unit pricing across a mixed booking', async () => {
      const { service, courts } = build();
      // 08:00-10:00, 60-min grid, maxSlots 2. Peak range covers 09:00-10:00 only.
      courts.findById.mockResolvedValue(
        makeCourt({
          gridIntervalMinutes: 60,
          maxSlots: 2,
          basePricePerGridUnit: 10_000,
          schedule: [{ day: 'MON', closed: false, openTime: '08:00', closeTime: '10:00' }],
          peakTimeRanges: [
            {
              id: 'peak-1',
              label: 'Evening',
              days: ['MON'],
              startTime: '09:00',
              endTime: '10:00',
              pricePerGridUnit: 20_000,
            },
          ],
        }),
      );

      const res = await service.computeAvailability(COURT_ID, DATE);

      const eightAm = res.starts.find((s) => s.startTime === '08:00')!;
      expect(eightAm.maxSlotCount).toBe(2);
      // 1-slot booking from 08:00: entirely base.
      expect(eightAm.pricePerSlotCount[0]).toBe(10_000);
      // 2-slot booking from 08:00: base (08:00) + peak (09:00).
      expect(eightAm.pricePerSlotCount[1]).toBe(10_000 + 20_000);

      const nineAm = res.starts.find((s) => s.startTime === '09:00')!;
      expect(nineAm.maxSlotCount).toBe(1);
      // 1-slot booking from 09:00: entirely peak.
      expect(nineAm.pricePerSlotCount[0]).toBe(20_000);
    });
  });
});

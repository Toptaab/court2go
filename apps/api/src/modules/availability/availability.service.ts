import { Injectable } from '@nestjs/common';
import type { AvailabilityResponse, AvailabilityStart, DayOfWeek, PeakTimeRange, TimeOfDay } from '@repo/types';
import {
  LATTICE_MINUTES,
  computePriceBreakdown,
  gridStartMinutes,
  maxSlotsFromStart,
  minutesToTime,
  timeToMinutes,
} from '@repo/domain';
import { ApiError } from '../../common/api-error';
import { CourtsRepository } from '../courts/courts.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import { ConfigRepository } from '../config/config.repository';

/**
 * Thailand-only MVP (PRD NFR9) — no timezone is stored anywhere in the schema.
 * The tenant local timezone is fixed to ICT = UTC+7, no DST. If the platform
 * ever goes multi-region this becomes a per-tenant/branch setting (flag-worthy,
 * not implemented now).
 */
const ICT_OFFSET_MINUTES = 420;

/** JS `Date.getUTCDay()` (0=SUN..6=SAT) → the platform's `DayOfWeek` enum. */
const WEEKDAY_BY_JS_DAY: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Combine an ICT calendar date (`YYYY-MM-DD`) and wall-clock time (`HH:MM`,
 * `24:00` permitted for end-of-day close) into the equivalent UTC instant.
 */
function ictLocalToUtc(date: string, time: TimeOfDay): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - ICT_OFFSET_MINUTES * 60_000);
}

/** The `DayOfWeek` (ICT calendar date) the queried date falls on — NOT the host-tz weekday. */
function resolveDayOfWeek(date: string): DayOfWeek {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAY_BY_JS_DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly courts: CourtsRepository,
    private readonly bookings: BookingsRepository,
    private readonly config: ConfigRepository,
  ) {}

  async computeAvailability(courtId: string, date: string): Promise<AvailabilityResponse> {
    const court = await this.courts.findById(courtId);
    // Mirror CatalogController.getCourt — never leak an inactive/deleted court.
    if (!court || !court.isActive || court.deletedAt) {
      throw ApiError.notFound('Court not found');
    }

    const dayOfWeek = resolveDayOfWeek(date);
    const entry = court.schedule.find((s) => s.day === dayOfWeek);

    if (!entry || entry.closed || entry.openTime === null || entry.closeTime === null) {
      return {
        courtId,
        date,
        gridIntervalMinutes: court.gridIntervalMinutes as AvailabilityResponse['gridIntervalMinutes'],
        maxSlots: court.maxSlots,
        closed: true,
        starts: [],
      };
    }

    const openTime = entry.openTime as TimeOfDay;
    const closeTime = entry.closeTime as TimeOfDay;
    const openMin = timeToMinutes(openTime);
    const closeMin = timeToMinutes(closeTime);

    const rangeStart = ictLocalToUtc(date, openTime);
    const rangeEnd = ictLocalToUtc(date, closeTime);

    const [activeSlots, blocks, config] = await Promise.all([
      this.bookings.findActiveSlots(courtId, rangeStart, rangeEnd),
      this.courts.listBlocksInRange(courtId, rangeStart, rangeEnd),
      this.config.get(),
    ]);

    const activeSlotTimes = new Set(activeSlots.map((s) => s.slotStart.getTime()));
    const leadCutoff = new Date(Date.now() + (config?.minBookingLeadTimeMinutes ?? 0) * 60_000);
    const advanceCutoff =
      config?.maxAdvanceBookingDays != null
        ? new Date(Date.now() + config.maxAdvanceBookingDays * 86_400_000)
        : null;

    const isLatticeUnitFree = (unitStart: Date): boolean => {
      const t = unitStart.getTime();
      if (activeSlotTimes.has(t)) return false;
      if (blocks.some((b) => b.startsAt.getTime() <= t && t < b.endsAt.getTime())) return false;
      if (unitStart < leadCutoff) return false;
      if (advanceCutoff !== null && unitStart >= advanceCutoff) return false;
      return true;
    };

    const peakTimeRanges: PeakTimeRange[] = court.peakTimeRanges.map((p) => ({
      id: p.id,
      label: p.label,
      days: p.days as unknown as DayOfWeek[],
      startTime: p.startTime as TimeOfDay,
      endTime: p.endTime as TimeOfDay,
      pricePerGridUnit: p.pricePerGridUnit,
    }));

    const gridIntervalMinutes = court.gridIntervalMinutes as AvailabilityResponse['gridIntervalMinutes'];
    const unitsPerSlot = gridIntervalMinutes / LATTICE_MINUTES;

    const starts: AvailabilityStart[] = gridStartMinutes(openMin, closeMin, gridIntervalMinutes).map(
      (gridStart) => {
        const startUtc = ictLocalToUtc(date, minutesToTime(gridStart));
        const theoreticalMax = maxSlotsFromStart(gridStart, closeMin, gridIntervalMinutes, court.maxSlots);

        let maxSlotCount = 0;
        outer: for (let k = 1; k <= theoreticalMax; k++) {
          for (let u = (k - 1) * unitsPerSlot; u < k * unitsPerSlot; u++) {
            const unitStart = new Date(startUtc.getTime() + u * LATTICE_MINUTES * 60_000);
            if (!isLatticeUnitFree(unitStart)) {
              break outer;
            }
          }
          maxSlotCount = k;
        }

        const pricePerSlotCount = Array.from({ length: maxSlotCount }, (_, i) =>
          computePriceBreakdown({
            gridIntervalMinutes,
            slotCount: i + 1,
            startMinutes: gridStart,
            day: dayOfWeek,
            basePricePerGridUnit: court.basePricePerGridUnit,
            peakTimeRanges,
          }).total,
        );

        return {
          startTime: minutesToTime(gridStart),
          startsAt: startUtc.toISOString(),
          maxSlotCount,
          pricePerSlotCount,
        };
      },
    );

    return {
      courtId,
      date,
      gridIntervalMinutes,
      maxSlots: court.maxSlots,
      closed: false,
      starts,
    };
  }
}

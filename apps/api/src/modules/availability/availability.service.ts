import { Injectable } from '@nestjs/common';
import {
  availabilityResponseSchema,
  type AvailabilityQuery,
  type AvailabilityResponse,
  type PeakTimeRange,
} from '@repo/types';
import { ApiError } from '../../common/api-error';
import { BookingsRepository } from '../bookings/bookings.repository';
import { CourtsRepository } from '../courts/courts.repository';
import type { AvailabilityCourtConfig, AvailabilityDaySchedule } from './availability.builder';
import { buildAvailability, buildTakenLatticeSet, resolveScheduleWindow } from './availability.builder';
import { bangkokDayOfWeek, bangkokLocalToUtc } from './bangkok-time';

/**
 * Orchestrates the availability read (PRD C1.2): load the court, resolve the
 * requested date's weekday/schedule and (if open) the taken-lattice set, then
 * hand off to the pure `buildAvailability` builder. ALL grid/price/lattice
 * logic lives in the builder — this class is I/O only.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly courts: CourtsRepository,
    private readonly bookings: BookingsRepository,
  ) {}

  async getAvailability(
    courtId: string,
    query: AvailabilityQuery,
    now: Date = new Date(),
  ): Promise<AvailabilityResponse> {
    const court = await this.courts.findById(courtId);
    // Public surface: 404 an inactive/deleted/missing court exactly like
    // CatalogController.getCourt rather than leak it.
    if (!court || !court.isActive || court.deletedAt) {
      throw ApiError.notFound('Court not found');
    }

    const day = bangkokDayOfWeek(query.date);
    const scheduleDay = court.schedule.find((s) => s.day === day);

    const resolvedDay: AvailabilityDaySchedule = scheduleDay
      ? {
          day,
          closed: scheduleDay.closed,
          openTime: scheduleDay.openTime,
          closeTime: scheduleDay.closeTime,
        }
      : { day, closed: true, openTime: null, closeTime: null };

    const courtConfig: AvailabilityCourtConfig = {
      courtId: court.id,
      gridIntervalMinutes: court.gridIntervalMinutes as AvailabilityCourtConfig['gridIntervalMinutes'],
      maxSlots: court.maxSlots,
      basePricePerGridUnit: court.basePricePerGridUnit,
      peakTimeRanges: court.peakTimeRanges as PeakTimeRange[],
    };

    // Same window resolution the builder uses (shared, so the DB query range and
    // the grid can't disagree); null => closed/misconfigured day, no slots to load.
    const window = resolveScheduleWindow(resolvedDay);
    if (window === null) {
      const response = buildAvailability({
        court: courtConfig,
        date: query.date,
        daySchedule: resolvedDay,
        takenLattice: new Set(),
        now,
      });
      return availabilityResponseSchema.parse(response);
    }

    const rangeStart = bangkokLocalToUtc(query.date, window.openMinutes);
    const rangeEnd = bangkokLocalToUtc(query.date, window.closeMinutes);

    const [activeSlots, blocks] = await Promise.all([
      this.bookings.findActiveSlots(courtId, rangeStart, rangeEnd),
      this.courts.listBlocksInRange(courtId, rangeStart, rangeEnd),
    ]);

    const takenLattice = buildTakenLatticeSet(
      activeSlots.map((s) => s.slotStart),
      blocks,
      rangeStart,
      rangeEnd,
    );

    const response = buildAvailability({
      court: courtConfig,
      date: query.date,
      daySchedule: resolvedDay,
      takenLattice,
      now,
    });
    // Fail-loud contract binding (ARCHITECTURE §3.2) — never respond with a
    // shape that hasn't round-tripped the shared schema.
    return availabilityResponseSchema.parse(response);
  }
}

import { z } from 'zod';
import {
  idSchema,
  timeOfDaySchema,
  latticeAlignedTimeSchema,
  isoDateTimeSchema,
  thbAmountSchema,
} from '../common/index';
import { dayOfWeekSchema, gridIntervalMinutesSchema } from '../enums/index';

/**
 * One day-of-week entry in a Court's schedule (PRD A5.1 AC7). A closed day has
 * no open/close times and yields no availability. `openTime` anchors the court's
 * start-time grid for that day (ARCHITECTURE §5.1).
 *
 * `openTime`/`closeTime` are constrained to the fixed 30-min lock lattice
 * (`latticeAlignedTimeSchema`, minute component :00 or :30). Because `openTime`
 * anchors the start-time grid and the internal lock lattice `booking_slot.slot_start`
 * is fixed to :00/:30, an off-lattice anchor would push every grid start off the
 * lattice and enable a silent double-book (ARCHITECTURE §5.1/§5.4). `closeTime`
 * still accepts `24:00` (end-of-day).
 */
export const courtScheduleDaySchema = z
  .object({
    day: dayOfWeekSchema,
    closed: z.boolean(),
    openTime: latticeAlignedTimeSchema.nullable(),
    closeTime: latticeAlignedTimeSchema.nullable(),
  })
  .refine((d) => d.closed || (d.openTime !== null && d.closeTime !== null), {
    message: 'open/close times required when the day is not closed',
  });
export type CourtScheduleDay = z.infer<typeof courtScheduleDaySchema>;

/**
 * A Peak Time Range (PRD A5.1 AC9). Applies to specific days; a grid unit whose
 * START falls within [startTime, endTime) on an applicable day is charged
 * `pricePerGridUnit` instead of the Court base price. Ranges must not overlap on
 * the same day (server-validated).
 */
export const peakTimeRangeSchema = z.object({
  id: idSchema,
  label: z.string().max(60).nullable(),
  days: z.array(dayOfWeekSchema).min(1),
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  /** Override price per GRID UNIT (of the court's gridInterval), THB satang. */
  pricePerGridUnit: thbAmountSchema,
});
export type PeakTimeRange = z.infer<typeof peakTimeRangeSchema>;

/**
 * Court (PRD §4, A5). The enabled-durations model was REMOVED; a court carries
 * `gridIntervalMinutes` + `maxSlots`. A booking = start (on the grid) + a slot
 * count 1..maxSlots; duration = slotCount × gridInterval. Pricing is the SUM of
 * per-grid-unit prices (base or peak by each unit's start), NOT a whole-booking rate.
 *
 * `basePricePerGridUnit` and each peak `pricePerGridUnit` are per grid unit — a
 * DIFFERENT granularity from the internal 30-min lock lattice (ARCHITECTURE §9.1);
 * keep them separate downstream.
 */
export const courtSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  sportId: idSchema,
  name: z.string().min(1).max(80),

  gridIntervalMinutes: gridIntervalMinutesSchema,
  maxSlots: z.number().int().min(1).max(48),

  basePricePerGridUnit: thbAmountSchema,
  peakTimeRanges: z.array(peakTimeRangeSchema),
  schedule: z.array(courtScheduleDaySchema).length(7),

  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type Court = z.infer<typeof courtSchema>;

/**
 * Public Court shape for the client flow (PRD C1.1/C1.2). Includes what the
 * picker needs: grid interval, max slots, base price, peak ranges — so the web
 * app can preview prices via packages/domain. Excludes internal/admin fields.
 */
export const publicCourtSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  sportId: idSchema,
  name: z.string(),
  gridIntervalMinutes: gridIntervalMinutesSchema,
  maxSlots: z.number().int(),
  basePricePerGridUnit: thbAmountSchema,
  peakTimeRanges: z.array(peakTimeRangeSchema),
  schedule: z.array(courtScheduleDaySchema).length(7),
});
export type PublicCourt = z.infer<typeof publicCourtSchema>;

/**
 * Court maintenance block (PRD A5.1 AC5) — makes a date/time range unavailable
 * without deactivating the court. Range is on the fixed 30-min lattice internally.
 */
export const courtBlockSchema = z.object({
  id: idSchema,
  courtId: idSchema,
  reason: z.string().max(200).nullable(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
});
export type CourtBlock = z.infer<typeof courtBlockSchema>;

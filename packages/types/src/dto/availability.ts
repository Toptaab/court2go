import { z } from 'zod';
import { isoDateSchema, isoDateTimeSchema, timeOfDaySchema, thbAmountSchema } from '../common/index';
import { gridIntervalMinutesSchema } from '../enums/index';

/**
 * Availability query (PRD C1.1 AC4). Grid computed at the court's grid interval;
 * a start point is selectable only if ALL underlying 30-min lattice units are free
 * (ARCHITECTURE §5). The 30-min lattice is internal and not exposed here.
 */
export const availabilityQuerySchema = z.object({
  date: isoDateSchema,
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

/**
 * One selectable start time on the court's grid for the queried date.
 * `maxSlotCount` = the largest contiguous slot span bookable from THIS start,
 * bounded by court maxSlots, the closing time, and the next occupied lattice unit
 * (PRD C1.2 AC1/AC2). If `maxSlotCount` is 0 the start is not currently selectable.
 * `pricePerSlotCount[k-1]` is the server-computed total (satang) for a k-slot booking
 * from this start — a preview aid; the authoritative price is re-derived at hold time.
 */
export const availabilityStartSchema = z.object({
  startTime: timeOfDaySchema,
  startsAt: isoDateTimeSchema,
  maxSlotCount: z.number().int().nonnegative(),
  /** Index i (0-based) holds the price for an (i+1)-slot booking; length === maxSlotCount. */
  pricePerSlotCount: z.array(thbAmountSchema),
});
export type AvailabilityStart = z.infer<typeof availabilityStartSchema>;

/** Availability response for a court+date (PRD C1). */
export const availabilityResponseSchema = z.object({
  courtId: z.string().uuid(),
  date: isoDateSchema,
  gridIntervalMinutes: gridIntervalMinutesSchema,
  maxSlots: z.number().int().min(1),
  /** Court closed that day => empty `starts`. */
  closed: z.boolean(),
  starts: z.array(availabilityStartSchema),
});
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;

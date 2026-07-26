import { z } from 'zod';
import { timeOfDaySchema, thbAmountSchema } from '../common/index';
import { gridIntervalMinutesSchema } from '../enums/index';
import { appliedPromotionSchema } from './promotion';

/**
 * One priced grid unit within a booking (PRD A5.1 AC10). Each occupied grid unit
 * is charged base or peak by the range its START falls into; the breakdown is the
 * transparent record of that per-unit calculation.
 */
export const pricedGridUnitSchema = z.object({
  /** 0-based index within the booking span. */
  index: z.number().int().nonnegative(),
  /** Local wall-clock start of this grid unit (HH:MM). */
  startTime: timeOfDaySchema,
  /** True if this unit's start fell inside a peak range. */
  isPeak: z.boolean(),
  /** Price charged for this unit (THB satang). */
  unitPrice: thbAmountSchema,
});
export type PricedGridUnit = z.infer<typeof pricedGridUnitSchema>;

/**
 * Server-authoritative price breakdown for a booking. Computed by packages/domain
 * and snapshotted onto the Booking/Payment at hold creation (ARCHITECTURE §7).
 * The client MAY compute an identical preview via the same domain function, but
 * the server value is the only one trusted — client-sent prices are never accepted.
 * Currency is always THB; amounts are integer satang.
 */
export const priceBreakdownSchema = z.object({
  currency: z.literal('THB'),
  gridIntervalMinutes: gridIntervalMinutesSchema,
  slotCount: z.number().int().min(1),
  units: z.array(pricedGridUnitSchema).min(1),
  /** Sum of per-unit prices, before discount. */
  subtotal: thbAmountSchema,
  /** Applied promotion snapshot, or null. */
  promotion: appliedPromotionSchema.nullable(),
  /** subtotal − promotion.discountAmount. This is the amount embedded in the QR. */
  total: thbAmountSchema,
});
export type PriceBreakdown = z.infer<typeof priceBreakdownSchema>;

import { z } from 'zod';
import { idSchema, isoDateTimeSchema, thbAmountSchema, timeOfDaySchema } from '../common/index';
import { branchPaymentMethodSchema, dayOfWeekSchema, gridIntervalMinutesSchema } from '../enums/index';
import { businessHoursDaySchema } from '../entities/branch';
import { courtScheduleDaySchema } from '../entities/court';

/* ================================================================= Branch */

/**
 * Create/update a Branch (PRD A4). `promptPayId` required iff paymentMethod=QR_CODE.
 * (PRD A4.1 AC6). Cross-field validation runs server-side and on the form.
 */
export const upsertBranchBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    address: z.string().max(500),
    paymentMethod: branchPaymentMethodSchema,
    promptPayId: z.string().min(1).max(60).nullable(),
    businessHours: z.array(businessHoursDaySchema).length(7),
  })
  .refine((b) => b.paymentMethod !== 'QR_CODE' || Boolean(b.promptPayId), {
    message: 'promptPayId is required when paymentMethod is QR_CODE',
    path: ['promptPayId'],
  });
export type UpsertBranchBody = z.infer<typeof upsertBranchBodySchema>;

/* ================================================================= Sport */

export const upsertSportBodySchema = z.object({
  name: z.string().min(1).max(80),
});
export type UpsertSportBody = z.infer<typeof upsertSportBodySchema>;

/* ================================================================= Court */

/** Peak range input (no id on create; server assigns). */
export const peakTimeRangeInputSchema = z.object({
  label: z.string().max(60).nullable().optional(),
  days: z.array(dayOfWeekSchema).min(1),
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
  pricePerGridUnit: thbAmountSchema,
});
export type PeakTimeRangeInput = z.infer<typeof peakTimeRangeInputSchema>;

/**
 * Create/update a Court (PRD A5.1, D7). grid interval + max slots (NOT durations).
 * Changing gridInterval/maxSlots is allowed anytime and is non-retroactive
 * (ARCHITECTURE §5.4). Branch Admin may only target courts in their own branch.
 */
export const upsertCourtBodySchema = z.object({
  branchId: idSchema,
  sportId: idSchema,
  name: z.string().min(1).max(80),
  gridIntervalMinutes: gridIntervalMinutesSchema,
  maxSlots: z.number().int().min(1).max(48),
  basePricePerGridUnit: thbAmountSchema,
  peakTimeRanges: z.array(peakTimeRangeInputSchema),
  schedule: z.array(courtScheduleDaySchema).length(7),
});
export type UpsertCourtBody = z.infer<typeof upsertCourtBodySchema>;

/** Create a maintenance block on a court (PRD A5.1 AC5). */
export const createCourtBlockBodySchema = z
  .object({
    reason: z.string().max(200).optional(),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
  })
  .refine((b) => b.endsAt > b.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });
export type CreateCourtBlockBody = z.infer<typeof createCourtBlockBodySchema>;

/* ================================================================= Lifecycle */

/**
 * Deactivate/soft-delete responses share a shape. Soft-delete 409s with
 * SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS if future bookings exist (PRD A5.1 AC4,
 * same pattern for Branch/Sport). Deactivate is always allowed.
 */
export const lifecycleResultSchema = z.object({
  id: idSchema,
  isActive: z.boolean(),
  deletedAt: isoDateTimeSchema.nullable(),
});
export type LifecycleResult = z.infer<typeof lifecycleResultSchema>;

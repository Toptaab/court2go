import { z } from 'zod';
import { idSchema, timeOfDaySchema, isoDateTimeSchema } from '../common/index';
import { branchPaymentMethodSchema, dayOfWeekSchema } from '../enums/index';

/** A single day's default business hours for a Branch. `closed` day => no times. */
export const businessHoursDaySchema = z
  .object({
    day: dayOfWeekSchema,
    closed: z.boolean(),
    openTime: timeOfDaySchema.nullable(),
    closeTime: timeOfDaySchema.nullable(),
  })
  .refine((d) => d.closed || (d.openTime !== null && d.closeTime !== null), {
    message: 'open/close times required when the day is not closed',
  });
export type BusinessHoursDay = z.infer<typeof businessHoursDaySchema>;

/**
 * Branch (PRD §4, A4). Payment method is a discriminant that forks the booking
 * lifecycle. `promptPayId` is required (and only meaningful) when method=QR_CODE
 * — a PromptPay ID (phone / national ID / e-wallet), NOT a static QR image
 * (PRD rev 6). The dynamic QR is generated per-booking from this id + amount.
 */
export const branchSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  address: z.string().max(500),
  paymentMethod: branchPaymentMethodSchema,
  /** Required iff paymentMethod === 'QR_CODE'; null for PAY_ONSITE. Never exposed on public DTOs. */
  promptPayId: z.string().min(1).max(60).nullable(),
  businessHours: z.array(businessHoursDaySchema).length(7),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type Branch = z.infer<typeof branchSchema>;

/**
 * Public-facing Branch shape (client booking flow, PRD C1.1). Excludes
 * `promptPayId` and inactivity — only active branches are ever returned publicly.
 * `paymentMethod` IS surfaced so the client flow knows whether to expect a payment step.
 */
export const publicBranchSchema = z.object({
  id: idSchema,
  name: z.string(),
  address: z.string(),
  paymentMethod: branchPaymentMethodSchema,
});
export type PublicBranch = z.infer<typeof publicBranchSchema>;

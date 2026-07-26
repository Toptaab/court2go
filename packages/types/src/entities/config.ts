import { z } from 'zod';
import { gridIntervalMinutesSchema } from '../enums/index';

/**
 * Tenant-level Config (PRD Domain Glossary + A8.1). All numeric OTP/session
 * defaults are stored here and Tenant-overridable (ARCHITECTURE §9 item 4);
 * changing them is schema-free.
 */
export const configSchema = z.object({
  /** Hold window — MVP allows only 5 or 10 minutes (PRD A8.1 AC6). */
  holdWindowMinutes: z.union([z.literal(5), z.literal(10)]),

  /** Long-lived client session length; default 30 days (ARCHITECTURE §9). */
  clientSessionDurationDays: z.number().int().min(1).max(365),

  /** OTP rules (PRD A8.1 AC5, ARCHITECTURE §9 defaults). */
  otpExpiryMinutes: z.number().int().min(1).max(30),
  otpMaxAttempts: z.number().int().min(1).max(10),
  otpResendCooldownSeconds: z.number().int().min(0).max(600),
  otpMaxSendsPerHour: z.number().int().min(1).max(50),

  /** Booking lead-time / advance-window rules (PRD A8.1 AC3, C1.3). */
  minBookingLeadTimeMinutes: z.number().int().min(0),
  maxAdvanceBookingDays: z.number().int().min(1).max(365),

  /** Self-service cancellation cutoff — PRD-fixed at 2h but stored for clarity/audit. */
  cancellationCutoffHours: z.number().int().min(0).default(2),

  /** Tenant-level defaults inherited by new Courts unless overridden (PRD A8.1 AC2). */
  defaultGridIntervalMinutes: gridIntervalMinutesSchema,
  defaultMaxSlots: z.number().int().min(1),
});
export type Config = z.infer<typeof configSchema>;

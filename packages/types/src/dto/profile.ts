import { z } from 'zod';
import { sexSchema } from '../enums/index';

/**
 * Update the current member's optional profile fields (PRD C6.1). None are
 * required; all nullable. Changing the PHONE is NOT done here — it goes through
 * OTP BIND (see dto/auth.ts, C6.1 AC4) to preserve phone-verification integrity.
 */
export const updateProfileBodySchema = z.object({
  name: z.string().max(120).nullable().optional(),
  emergencyContact: z.string().max(120).nullable().optional(),
  sex: sexSchema.nullable().optional(),
});
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

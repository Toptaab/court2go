import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from '../common/index';

/** Sport (PRD §4, A3) — Tenant-level activity type assigned to Courts. */
export const sportSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type Sport = z.infer<typeof sportSchema>;

/** Public Sport shape (client flow shows only sports with ≥1 active court in branch). */
export const publicSportSchema = z.object({
  id: idSchema,
  name: z.string(),
});
export type PublicSport = z.infer<typeof publicSportSchema>;

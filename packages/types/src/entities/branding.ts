import { z } from 'zod';
import { hexColorSchema, urlSchema } from '../common/index';

/**
 * Tenant Branding (PRD A8.2, DESIGN D15). Light white-label: one logo + CI color.
 * DESIGN tokens derive every tint from the single `--accent` color, so one color
 * is the load-bearing field; `secondaryColor` is optional future headroom.
 */
export const brandingSchema = z.object({
  /** Public URL of the tenant logo (object storage, public-read key). Null = use default. */
  logoUrl: urlSchema.nullable(),
  /** Primary CI / accent color (maps to DESIGN `--accent`). Null = neutral default. */
  primaryColor: hexColorSchema.nullable(),
  /** Optional secondary color; unused by MVP tokens but reserved. */
  secondaryColor: hexColorSchema.nullable(),
});
export type Branding = z.infer<typeof brandingSchema>;

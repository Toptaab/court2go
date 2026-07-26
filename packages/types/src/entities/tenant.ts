import { z } from 'zod';
import { idSchema, slugSchema, isoDateTimeSchema } from '../common/index';
import { brandingSchema } from './branding';
import { configSchema } from './config';

/**
 * Tenant — the venue-operator account (PRD §4). Provisioned by internal ops only;
 * no self-serve signup in the contract. Every other entity carries `tenantId`,
 * but that FK is enforced by RLS server-side and is NOT echoed on nested response
 * DTOs (the tenant is implicit in the request scope, ARCHITECTURE §2).
 */
export const tenantSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  name: z.string().min(1).max(120),
  createdAt: isoDateTimeSchema,
});
export type Tenant = z.infer<typeof tenantSchema>;

/**
 * Public tenant bootstrap payload — returned by `GET /tenants/by-slug/{slug}`,
 * the one unauthenticated tenant-resolution call the web middleware makes
 * (ARCHITECTURE §2.2). Carries only what the public shell needs: identity +
 * branding + the client-relevant config subset (NOT the OTP/security internals).
 */
export const publicTenantSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  name: z.string(),
  branding: brandingSchema,
  publicConfig: z.object({
    holdWindowMinutes: configSchema.shape.holdWindowMinutes,
    minBookingLeadTimeMinutes: configSchema.shape.minBookingLeadTimeMinutes,
    maxAdvanceBookingDays: configSchema.shape.maxAdvanceBookingDays,
    cancellationCutoffHours: configSchema.shape.cancellationCutoffHours,
  }),
});
export type PublicTenant = z.infer<typeof publicTenantSchema>;

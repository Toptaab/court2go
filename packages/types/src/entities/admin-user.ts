import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from '../common/index';
import { roleSchema } from '../enums/index';

/**
 * AdminUser (PRD §4, A9 / ARCHITECTURE §3.3). Email+password login (ADR-0005).
 * `branchId` is non-null ONLY for BRANCH_ADMIN (single-branch scope, enforced
 * server-side). Password hash never crosses the wire — not in this schema.
 */
export const adminUserSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: roleSchema,
  /** Assigned branch for BRANCH_ADMIN; null for OWNER/ADMIN (tenant-wide). */
  branchId: idSchema.nullable(),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/** The authenticated admin's own identity (from AdminSession) — drives RBAC UI. */
export const adminMeSchema = adminUserSchema;
export type AdminMe = z.infer<typeof adminMeSchema>;

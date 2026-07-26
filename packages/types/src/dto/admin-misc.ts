import { z } from 'zod';
import { idSchema, isoDateTimeSchema, urlSchema } from '../common/index';
import { paginationQuerySchema } from '../common/pagination';
import {
  discountTypeSchema,
  newsStatusSchema,
  roleSchema,
} from '../enums/index';
import { configSchema } from '../entities/config';
import { brandingSchema } from '../entities/branding';

/* ================================================================= Promotion */

export const upsertPromotionBodySchema = z
  .object({
    code: z.string().min(1).max(40),
    description: z.string().max(200).nullable().optional(),
    discountType: discountTypeSchema,
    discountValue: z.number().int().positive(),
    validFrom: isoDateTimeSchema,
    validUntil: isoDateTimeSchema,
    branchId: idSchema.nullable().optional(),
    sportId: idSchema.nullable().optional(),
    courtId: idSchema.nullable().optional(),
    maxTotalUses: z.number().int().positive().nullable().optional(),
    maxUsesPerMember: z.number().int().positive().nullable().optional(),
  })
  .refine((p) => p.discountType !== 'PERCENTAGE' || p.discountValue <= 100, {
    message: 'percentage discount must be 1..100',
    path: ['discountValue'],
  })
  .refine((p) => p.validUntil > p.validFrom, {
    message: 'validUntil must be after validFrom',
    path: ['validUntil'],
  });
export type UpsertPromotionBody = z.infer<typeof upsertPromotionBodySchema>;

/** A single redemption row for the promotion usage view (PRD A6.1 AC4). */
export const promotionUsageItemSchema = z.object({
  bookingId: idSchema,
  memberId: idSchema,
  memberPhone: z.string().nullable(),
  discountAmount: z.number().int(),
  usedAt: isoDateTimeSchema,
});
export type PromotionUsageItem = z.infer<typeof promotionUsageItemSchema>;

/* ================================================================= News */

export const upsertNewsBodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(10000),
  imageUrl: urlSchema.nullable().optional(),
  status: newsStatusSchema,
});
export type UpsertNewsBody = z.infer<typeof upsertNewsBodySchema>;

/* ================================================================= Member (admin) */

export const adminMemberListQuerySchema = paginationQuerySchema.extend({
  /** Search by phone or name. */
  q: z.string().optional(),
});
export type AdminMemberListQuery = z.infer<typeof adminMemberListQuerySchema>;

export const adminBlockMemberBodySchema = z.object({
  blocked: z.boolean(),
  reason: z.string().max(500).optional(),
});
export type AdminBlockMemberBody = z.infer<typeof adminBlockMemberBodySchema>;

/* ================================================================= Config (admin) */

/** Full-replace config (PRD A8.1). PUT semantics — send the whole object. */
export const updateConfigBodySchema = configSchema;
export type UpdateConfigBody = z.infer<typeof updateConfigBodySchema>;

/* ================================================================= Branding (admin) */

export const updateBrandingBodySchema = brandingSchema;
export type UpdateBrandingBody = z.infer<typeof updateBrandingBodySchema>;

/**
 * Presigned upload URL for public images (logo, news) — public-read key
 * (ARCHITECTURE §4.4). Distinct from the private slip upload flow.
 */
export const imageUploadUrlBodySchema = z.object({
  purpose: z.enum(['LOGO', 'NEWS']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  contentLength: z.number().int().positive(),
});
export type ImageUploadUrlBody = z.infer<typeof imageUploadUrlBodySchema>;

export const imageUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  /** Final public URL the image will be served from after upload. */
  publicUrl: urlSchema,
  requiredHeaders: z.record(z.string(), z.string()),
  expiresAt: isoDateTimeSchema,
});
export type ImageUploadUrlResponse = z.infer<typeof imageUploadUrlResponseSchema>;

/* ================================================================= Admin users / roles */

/**
 * Create an AdminUser (PRD A9). OWNER cannot be created via API (assigned at
 * tenant provisioning). Only OWNER/ADMIN may create; BRANCH_ADMIN requires branchId.
 */
export const createAdminUserBodySchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).max(120),
    password: z.string().min(8).max(200),
    role: z.enum(['ADMIN', 'BRANCH_ADMIN']),
    branchId: idSchema.nullable().optional(),
  })
  .refine((a) => a.role !== 'BRANCH_ADMIN' || Boolean(a.branchId), {
    message: 'branchId is required for BRANCH_ADMIN',
    path: ['branchId'],
  });
export type CreateAdminUserBody = z.infer<typeof createAdminUserBodySchema>;

/** Update an AdminUser. Role change to/from BRANCH_ADMIN requires branch consistency. */
export const updateAdminUserBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(['ADMIN', 'BRANCH_ADMIN']).optional(),
  branchId: idSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  /** Optional password reset. */
  password: z.string().min(8).max(200).optional(),
});
export type UpdateAdminUserBody = z.infer<typeof updateAdminUserBodySchema>;

/**
 * Roles matrix view (DESIGN D16) — declarative capability grid the admin UI renders.
 * Server is the source of truth for enforcement; this is a presentational mirror.
 */
export const rolesMatrixSchema = z.object({
  roles: z.array(roleSchema),
  capabilities: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      allowed: z.record(roleSchema, z.boolean()),
    }),
  ),
});
export type RolesMatrix = z.infer<typeof rolesMatrixSchema>;

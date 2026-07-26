import { z } from 'zod';
import {
  idSchema,
  isoDateTimeSchema,
  thbAmountSchema,
} from '../common/index';
import { discountTypeSchema } from '../enums/index';

/**
 * Promotion (PRD §4, A6, C4.2). Percentage or fixed discount, validity window,
 * optional scope to branch/sport/court, and usage limits (total + per-member).
 * Applied to a booking's amount before the client transfers/uploads a slip.
 */
export const promotionSchema = z
  .object({
    id: idSchema,
    code: z.string().min(1).max(40),
    description: z.string().max(200).nullable(),
    discountType: discountTypeSchema,
    /** For PERCENTAGE: integer 1..100. For FIXED: THB satang (>0). */
    discountValue: z.number().int().positive(),

    validFrom: isoDateTimeSchema,
    validUntil: isoDateTimeSchema,

    // Optional scoping — null means "applies tenant-wide for that dimension".
    branchId: idSchema.nullable(),
    sportId: idSchema.nullable(),
    courtId: idSchema.nullable(),

    /** Total redemption cap across all members; null = unlimited. */
    maxTotalUses: z.number().int().positive().nullable(),
    /** Per-member redemption cap; null = unlimited. */
    maxUsesPerMember: z.number().int().positive().nullable(),
    /** Current total redemptions (read-only aggregate). */
    totalUses: z.number().int().nonnegative(),

    isActive: z.boolean(),
    createdAt: isoDateTimeSchema,
  })
  .refine(
    (p) => p.discountType !== 'PERCENTAGE' || p.discountValue <= 100,
    { message: 'percentage discount must be 1..100', path: ['discountValue'] },
  );
export type Promotion = z.infer<typeof promotionSchema>;

/**
 * Snapshot of an applied promotion, embedded in a Booking's price breakdown.
 * Snapshotted so historical bookings are unaffected by later promo edits (A6.3).
 */
export const appliedPromotionSchema = z.object({
  promotionId: idSchema,
  code: z.string(),
  discountType: discountTypeSchema,
  discountValue: z.number().int(),
  /** Actual THB satang discount applied to THIS booking. */
  discountAmount: thbAmountSchema,
});
export type AppliedPromotion = z.infer<typeof appliedPromotionSchema>;

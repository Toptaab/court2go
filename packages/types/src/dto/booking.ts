import { z } from 'zod';
import { isoDateTimeSchema } from '../common/index';
import { bookingStatusSchema, paymentStatusSchema, branchPaymentMethodSchema } from '../enums/index';
import { bookingDetailSchema } from '../entities/booking';
import { paginationQuerySchema } from '../common/pagination';

/**
 * Create a Hold (PRD C1.2, ARCHITECTURE §5.1). Body is `{ start, slotCount }` —
 * NOT a duration. Server validates: start aligns to the court grid, slotCount is
 * 1..maxSlots, the span is contiguous/free, within lead-time & closing bounds.
 * Optional `promoCode` is applied to the snapshotted price at hold time.
 *
 * 201 => Hold created. 409 SLOT_UNAVAILABLE => a lattice unit was taken concurrently.
 */
export const createHoldBodySchema = z.object({
  /** Grid start instant (must match a grid start returned by availability). */
  start: isoDateTimeSchema,
  slotCount: z.number().int().min(1),
  promoCode: z.string().min(1).max(40).optional(),
});
export type CreateHoldBody = z.infer<typeof createHoldBodySchema>;

/**
 * Hold creation result. `nextStep` tells the client where the lifecycle goes,
 * derived from the branch payment method + member phoneVerified state:
 *  - VERIFY_PHONE: member phone not yet verified → OTP (LOGIN or BIND) required next.
 *  - UPLOAD_SLIP:  QR branch, phone verified → go to payment (slip upload).
 *  - CONFIRMED:    Pay-Onsite branch, phone verified → already Confirmed.
 */
export const createHoldResponseSchema = z.object({
  booking: bookingDetailSchema,
  branchPaymentMethod: branchPaymentMethodSchema,
  nextStep: z.enum(['VERIFY_PHONE', 'UPLOAD_SLIP', 'CONFIRMED']),
});
export type CreateHoldResponse = z.infer<typeof createHoldResponseSchema>;

/** Apply / re-apply a promo code to an existing hold (PRD C4.2). Returns updated detail. */
export const applyPromoBodySchema = z.object({
  code: z.string().min(1).max(40),
});
export type ApplyPromoBody = z.infer<typeof applyPromoBodySchema>;

/* ------------------------------------------------------------------ Payment (client) */

/**
 * Request a presigned PUT URL to upload the slip image directly to object storage
 * (ARCHITECTURE §4.4 — binary never proxied through the API). Client PUTs the file
 * to `uploadUrl`, then calls confirm-slip with `objectKey`.
 */
export const slipUploadUrlBodySchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  /** Client-reported byte size for pre-validation; server enforces its own cap. */
  contentLength: z.number().int().positive(),
});
export type SlipUploadUrlBody = z.infer<typeof slipUploadUrlBodySchema>;

export const slipUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  objectKey: z.string(),
  /** Headers the client must echo on the PUT (e.g. Content-Type). */
  requiredHeaders: z.record(z.string(), z.string()),
  expiresAt: isoDateTimeSchema,
});
export type SlipUploadUrlResponse = z.infer<typeof slipUploadUrlResponseSchema>;

/**
 * Confirm the slip was uploaded (PRD C3.1 AC2). Moves booking →
 * PENDING_PAYMENT_CONFIRMATION, payment → SLIP_UPLOADED_PENDING_REVIEW; grid stays reserved.
 */
export const confirmSlipBodySchema = z.object({
  objectKey: z.string().min(1),
});
export type ConfirmSlipBody = z.infer<typeof confirmSlipBodySchema>;

/* ------------------------------------------------------------------ Cancellation (client) */

/** Request cancellation of a Confirmed booking >2h before start (PRD C4.3). */
export const cancellationRequestBodySchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancellationRequestBody = z.infer<typeof cancellationRequestBodySchema>;

/* ------------------------------------------------------------------ My bookings (client) */

/** List the current member's bookings (PRD C5.1). */
export const myBookingsQuerySchema = paginationQuerySchema.extend({
  status: bookingStatusSchema.optional(),
  /** 'upcoming' => startsAt >= now; 'past' => startsAt < now. */
  scope: z.enum(['upcoming', 'past', 'all']).default('all'),
});
export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;

/** Compact list row (also reused by admin list view). */
export const bookingListItemSchema = z.object({
  id: z.string().uuid(),
  status: bookingStatusSchema,
  paymentStatus: paymentStatusSchema,
  branchName: z.string(),
  sportName: z.string(),
  courtName: z.string(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  slotCount: z.number().int(),
  amountDue: z.number().int(),
  memberPhone: z.string().nullable(),
  memberName: z.string().nullable(),
});
export type BookingListItem = z.infer<typeof bookingListItemSchema>;

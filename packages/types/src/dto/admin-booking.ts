import { z } from 'zod';
import {
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  thaiPhoneSchema,
  urlSchema,
} from '../common/index';
import { paginationQuerySchema } from '../common/pagination';
import { bookingStatusSchema, paymentStatusSchema } from '../enums/index';
import { bookingListItemSchema } from './booking';

/**
 * Admin booking list filters (PRD A2.1, D2). Branch Admins are additionally
 * constrained server-side to their assigned branch regardless of the `branchId`
 * filter sent. `paymentStatus=SLIP_UPLOADED_PENDING_REVIEW` is the review queue (A2.3);
 * `status=CANCELLATION_REQUESTED` is the cancellation queue (A2.4).
 */
export const adminBookingListQuerySchema = paginationQuerySchema.extend({
  branchId: idSchema.optional(),
  sportId: idSchema.optional(),
  courtId: idSchema.optional(),
  status: bookingStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  /** Free-text search, primarily by member phone (PRD A2.1 AC2). */
  phone: z.string().optional(),
});
export type AdminBookingListQuery = z.infer<typeof adminBookingListQuerySchema>;

/**
 * Calendar query (PRD A1, D1) — bookings for one date across the courts of one
 * branch, plotted on the 30-min grid client-side.
 */
export const adminCalendarQuerySchema = z.object({
  branchId: idSchema,
  date: isoDateSchema,
});
export type AdminCalendarQuery = z.infer<typeof adminCalendarQuerySchema>;

/**
 * Calendar response item — `BookingListItem` plus `courtId`, which the
 * calendar view needs to place each booking in its own court column
 * (`courtName` alone isn't a safe grouping key — nothing stops two courts
 * across branches, or in future same-branch data, from sharing a name).
 */
export const adminCalendarItemSchema = bookingListItemSchema.extend({
  courtId: idSchema,
});
export type AdminCalendarItem = z.infer<typeof adminCalendarItemSchema>;

/* ------------------------------------------------------------------ Walk-in create */

/**
 * Staff walk-in booking (PRD A2.2). No OTP (auditable ADM_OVERRIDE). Member is
 * selected by id or quick-created by phone (server rejects a duplicate within tenant).
 * `directConfirmPayment` marks payment Confirmed immediately (cash collected, A2.2 AC3);
 * on a Pay-Onsite branch the booking auto-confirms regardless.
 */
export const adminCreateBookingBodySchema = z
  .object({
    courtId: idSchema,
    start: isoDateTimeSchema,
    slotCount: z.number().int().min(1),
    /** Provide exactly one of memberId | newMemberPhone. */
    memberId: idSchema.optional(),
    newMemberPhone: thaiPhoneSchema.optional(),
    newMemberName: z.string().max(120).optional(),
    promoCode: z.string().min(1).max(40).optional(),
    /** QR branch only: confirm payment directly without a slip (cash). */
    directConfirmPayment: z.boolean().default(false),
  })
  .refine((b) => Boolean(b.memberId) !== Boolean(b.newMemberPhone), {
    message: 'provide exactly one of memberId or newMemberPhone',
  });
export type AdminCreateBookingBody = z.infer<typeof adminCreateBookingBodySchema>;

/* ------------------------------------------------------------------ Modify */

/**
 * Admin modify (PRD A2.1 AC3, ARCHITECTURE §5.2). Change time/court/slotCount;
 * implemented as release-old-then-reinsert in one txn — if new units aren't free
 * the whole modify rolls back (409 SLOT_UNAVAILABLE), original untouched.
 * All fields optional; at least one required.
 */
export const adminModifyBookingBodySchema = z
  .object({
    courtId: idSchema.optional(),
    start: isoDateTimeSchema.optional(),
    slotCount: z.number().int().min(1).optional(),
  })
  .refine((b) => b.courtId || b.start || b.slotCount, {
    message: 'at least one of courtId, start, slotCount required',
  });
export type AdminModifyBookingBody = z.infer<typeof adminModifyBookingBodySchema>;

/* ------------------------------------------------------------------ Cancel / status */

export const adminCancelBookingBodySchema = z.object({
  reason: z.string().max(500).optional(),
});
export type AdminCancelBookingBody = z.infer<typeof adminCancelBookingBodySchema>;

/** Mark COMPLETED or NO_SHOW (PRD A2.1 AC4, admin-manual). */
export const adminSetBookingOutcomeBodySchema = z.object({
  outcome: z.enum(['COMPLETED', 'NO_SHOW']),
});
export type AdminSetBookingOutcomeBody = z.infer<typeof adminSetBookingOutcomeBodySchema>;

/* ------------------------------------------------------------------ Payment review */

/** Confirm an uploaded slip (or direct-confirm) — PRD A2.3 AC2. */
export const adminConfirmPaymentBodySchema = z.object({
  note: z.string().max(500).optional(),
});
export type AdminConfirmPaymentBody = z.infer<typeof adminConfirmPaymentBodySchema>;

/** Reject an uploaded slip (PRD A2.3 AC3) — releases the grid, notifies client. */
export const adminRejectPaymentBodySchema = z.object({
  reason: z.string().min(1).max(500),
});
export type AdminRejectPaymentBody = z.infer<typeof adminRejectPaymentBodySchema>;

/** Short-lived signed GET URL for the slip image (ARCHITECTURE §4.4). */
export const slipViewUrlResponseSchema = z.object({
  slipUrl: urlSchema,
  expiresAt: isoDateTimeSchema,
});
export type SlipViewUrlResponse = z.infer<typeof slipViewUrlResponseSchema>;

/* ------------------------------------------------------------------ Cancellation review */

/** Approve/decline a client cancellation request (PRD A2.4). */
export const adminCancellationDecisionBodySchema = z.object({
  decision: z.enum(['APPROVE', 'DECLINE']),
  /** Optional reason surfaced to the client (esp. on decline). */
  reason: z.string().max(500).optional(),
});
export type AdminCancellationDecisionBody = z.infer<typeof adminCancellationDecisionBodySchema>;

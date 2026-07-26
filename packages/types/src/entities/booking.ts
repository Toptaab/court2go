import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from '../common/index';
import {
  bookingStatusSchema,
  branchPaymentMethodSchema,
  verifiedViaSchema,
} from '../enums/index';
import { priceBreakdownSchema } from './pricing';
import { paymentSchema } from './payment';

/**
 * Denormalized labels carried on a booking for list/calendar rendering without
 * N extra fetches (DESIGN D1/D2, C5). These are snapshots of names at read time.
 */
export const bookingContextSchema = z.object({
  branchId: idSchema,
  branchName: z.string(),
  branchPaymentMethod: branchPaymentMethodSchema,
  sportId: idSchema,
  sportName: z.string(),
  courtId: idSchema,
  courtName: z.string(),
});
export type BookingContext = z.infer<typeof bookingContextSchema>;

/**
 * Booking (PRD §4, ARCHITECTURE §6). A booking is a start + slotCount (1..maxSlots)
 * on one court. Duration = slotCount × gridInterval; the server expands it onto the
 * fixed 30-min lock lattice internally — that lattice is NOT part of this contract.
 *
 * `startsAt`/`endsAt` are the resolved instants; `gridIntervalMinutes` is snapshotted
 * so a later court re-config never rewrites historical bookings (ARCHITECTURE §5.4).
 */
export const bookingSchema = z.object({
  id: idSchema,
  memberId: idSchema,
  context: bookingContextSchema,

  status: bookingStatusSchema,

  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  gridIntervalMinutes: z.number().int(),
  slotCount: z.number().int().min(1),

  /** Snapshotted price (server-authoritative). */
  price: priceBreakdownSchema,

  /** How the member identity was verified (self OTP vs. staff walk-in override). */
  verifiedVia: verifiedViaSchema,
  /** True for staff-created walk-in bookings (PRD A2.2). */
  isWalkIn: z.boolean(),

  /** When the Hold expires; null once terminal/confirmed. */
  holdExpiresAt: isoDateTimeSchema.nullable(),

  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Booking = z.infer<typeof bookingSchema>;

/**
 * Full booking detail = booking + its payment + minimal member summary. Returned
 * by GET booking detail (client M15/M16, admin D2 detail). Payment is nullable
 * only transiently before it's created; in practice always present post-hold.
 */
export const bookingDetailSchema = bookingSchema.extend({
  payment: paymentSchema,
  member: z.object({
    id: idSchema,
    phone: z.string().nullable(),
    name: z.string().nullable(),
    phoneVerified: z.boolean(),
  }),
  /** Actions the current actor may take on this booking (server-computed, RBAC/policy aware). */
  allowedActions: z.array(
    z.enum([
      'REQUEST_CANCELLATION', // client, >2h before start
      'UPLOAD_SLIP', // client, QR branch, PENDING_PAYMENT
      'ADMIN_CONFIRM_PAYMENT',
      'ADMIN_REJECT_PAYMENT',
      'ADMIN_MODIFY',
      'ADMIN_CANCEL',
      'ADMIN_APPROVE_CANCELLATION',
      'ADMIN_DECLINE_CANCELLATION',
      'ADMIN_MARK_COMPLETED',
      'ADMIN_MARK_NO_SHOW',
    ]),
  ),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;

import {
  bookingDetailSchema,
  bookingListItemSchema,
  paymentSchema,
  priceBreakdownSchema,
  type BookingDetail,
  type BookingListItem,
} from '@repo/types';
import type { Booking, Member, Payment } from '../../generated/prisma/client';

/** Row shape needed to render one `BookingListItem` (member.mapMemberToMe-style
 * mapping) — `listForMember`/`listForAdmin` both include `payment` + `member`. */
export type BookingListRow = Booking & {
  payment: Payment | null;
  member: Pick<Member, 'phone' | 'name'>;
};

/** The subset of `Booking` needed to render its (real or provisional) `Payment`. */
type PaymentCarrier = Pick<Booking, 'id' | 'branchPaymentMethod' | 'totalAmount' | 'createdAt' | 'updatedAt'>;

type AllowedAction = BookingDetail['allowedActions'][number];

/**
 * Actions the MEMBER actor may take on a booking (server-computed,
 * PRD C4.2/C4.3 + M6 build note). Admin actions are M9 — omitted here.
 *
 *  - REQUEST_CANCELLATION: status=CONFIRMED and `now` is still more than
 *    `cancellationCutoffHours` before `startsAt`.
 *  - UPLOAD_SLIP: status=PENDING_PAYMENT on a QR_CODE branch (Pay-Onsite
 *    bookings never reach PENDING_PAYMENT at all).
 */
export function computeAllowedActions(
  booking: Pick<Booking, 'status' | 'startsAt' | 'branchPaymentMethod'>,
  now: Date,
  cancellationCutoffHours: number,
): AllowedAction[] {
  const actions: AllowedAction[] = [];

  if (booking.status === 'CONFIRMED') {
    const cutoff = new Date(booking.startsAt.getTime() - cancellationCutoffHours * 60 * 60_000);
    if (now < cutoff) actions.push('REQUEST_CANCELLATION');
  }

  if (booking.status === 'PENDING_PAYMENT' && booking.branchPaymentMethod === 'QR_CODE') {
    actions.push('UPLOAD_SLIP');
  }

  return actions;
}

/**
 * Map a booking's `Payment` row to the contract `Payment` DTO. QR generation
 * is out of scope for M6 (deferred to the PromptPay integration milestone) —
 * `qr` is always `null` here regardless of branch payment method. `slipUrl`
 * is likewise always `null` — signed GET URL issuance is `PaymentService`'s
 * concern (ARCHITECTURE §4.4), not implemented in this milestone.
 *
 * When the booking has NOT yet advanced out of PENDING_VERIFICATION (no
 * Payment row exists yet), a PROVISIONAL Payment DTO is synthesized so
 * `BookingDetail.payment` — non-nullable in the contract — is always
 * present. Its `id` is the booking's own id (documented placeholder: no real
 * Payment row exists yet, and the contract requires a UUID-shaped `id`).
 */
function mapPayment(booking: PaymentCarrier, payment: Payment | null): BookingDetail['payment'] {
  if (payment) {
    return paymentSchema.parse({
      id: payment.id,
      bookingId: payment.bookingId,
      status: payment.status,
      amountDue: payment.amountDue,
      qr: null,
      slipUrl: null,
      slipUploadedAt: payment.slipUploadedAt?.toISOString() ?? null,
      reviewedByAdminId: payment.reviewedByAdminId,
      reviewedAt: payment.reviewedAt?.toISOString() ?? null,
      rejectionReason: payment.rejectionReason,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    });
  }

  const provisionalStatus = booking.branchPaymentMethod === 'QR_CODE' ? 'AWAITING_SLIP_UPLOAD' : 'PAY_ONSITE_NOT_COLLECTED';
  return paymentSchema.parse({
    id: booking.id,
    bookingId: booking.id,
    status: provisionalStatus,
    amountDue: booking.totalAmount,
    qr: null,
    slipUrl: null,
    slipUploadedAt: null,
    reviewedByAdminId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  });
}

/**
 * Prisma `Booking` (+ its `Payment`, + a Member summary) → `BookingDetail`
 * (ARCHITECTURE §3.1: map at the boundary). `opts.now`/`opts.cancellationCutoffHours`
 * feed `computeAllowedActions` — callers own fetching `Config.cancellationCutoffHours`
 * since this mapper has no repository access.
 */
export function mapToBookingDetail(
  booking: Booking,
  payment: Payment | null,
  member: Pick<Member, 'id' | 'phone' | 'name' | 'phoneVerified'>,
  opts: { now: Date; cancellationCutoffHours: number },
): BookingDetail {
  return bookingDetailSchema.parse({
    id: booking.id,
    memberId: booking.memberId,
    context: {
      branchId: booking.branchId,
      branchName: booking.branchName,
      branchPaymentMethod: booking.branchPaymentMethod,
      sportId: booking.sportId,
      sportName: booking.sportName,
      courtId: booking.courtId,
      courtName: booking.courtName,
    },
    status: booking.status,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    gridIntervalMinutes: booking.gridIntervalMinutes,
    slotCount: booking.slotCount,
    price: priceBreakdownSchema.parse(booking.priceBreakdown),
    verifiedVia: booking.verifiedVia,
    isWalkIn: booking.isWalkIn,
    holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    payment: mapPayment(booking, payment),
    member: {
      id: member.id,
      phone: member.phone,
      name: member.name,
      phoneVerified: member.phoneVerified,
    },
    allowedActions: computeAllowedActions(booking, opts.now, opts.cancellationCutoffHours),
  });
}

/**
 * Compact list row (`GET /me/bookings`, PRD C5.1). `paymentStatus` mirrors
 * the same provisional-status derivation as `mapPayment` when no Payment row
 * exists yet (pre-verification hold) so the list is never left rendering a
 * missing status.
 */
export function mapToBookingListItem(row: BookingListRow): BookingListItem {
  const paymentStatus =
    row.payment?.status ?? (row.branchPaymentMethod === 'QR_CODE' ? 'AWAITING_SLIP_UPLOAD' : 'PAY_ONSITE_NOT_COLLECTED');

  return bookingListItemSchema.parse({
    id: row.id,
    status: row.status,
    paymentStatus,
    branchName: row.branchName,
    sportName: row.sportName,
    courtName: row.courtName,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    slotCount: row.slotCount,
    amountDue: row.payment?.amountDue ?? row.totalAmount,
    memberPhone: row.member.phone,
    memberName: row.member.name,
  });
}

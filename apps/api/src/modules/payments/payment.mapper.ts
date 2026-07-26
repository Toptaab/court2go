import { paymentSchema, type Payment as PaymentDto, type PromptPayQr } from '@repo/types';
import type { PaymentStatus } from '../../generated/prisma/client';

/**
 * The subset of a Prisma `Payment` row (real OR the provisional row
 * `PaymentService` synthesizes when no `Payment` exists yet, mirroring
 * `booking.mapper.ts`'s `mapPayment`) needed to render the contract `Payment`
 * DTO. `qr`/`slipUrl` are deliberately NOT part of this shape — both require
 * I/O via an integration port (`PromptPayQrService`/`ObjectStorage`), which
 * this module has no access to (ARCHITECTURE §3.1: mappers are pure). The
 * caller (`PaymentService`) generates them and passes them in.
 */
export interface PaymentRowLike {
  id: string;
  bookingId: string;
  status: PaymentStatus;
  amountDue: number;
  slipUploadedAt: Date | null;
  reviewedByAdminId: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment statuses for which a still-actionable PromptPay QR should be
 * rendered (ARCHITECTURE §4.3/§6.2) — before a slip has been reviewed either
 * way. `CONFIRMED`/`REJECTED`/`PAY_ONSITE_NOT_COLLECTED` never show a QR.
 */
export const QR_ELIGIBLE_PAYMENT_STATUSES: PaymentStatus[] = ['AWAITING_SLIP_UPLOAD', 'SLIP_UPLOADED_PENDING_REVIEW'];

/**
 * Pure map: `PaymentRowLike` (+ pre-generated `qr`/`slipUrl`) → the contract
 * `Payment` DTO (parsed through `paymentSchema`, ARCHITECTURE §3.1 "map at
 * the boundary"). Mirrors `booking.mapper.ts`'s `mapPayment` field-for-field.
 */
export function mapPayment(row: PaymentRowLike, opts: { qr: PromptPayQr | null; slipUrl: string | null }): PaymentDto {
  return paymentSchema.parse({
    id: row.id,
    bookingId: row.bookingId,
    status: row.status,
    amountDue: row.amountDue,
    qr: opts.qr,
    slipUrl: opts.slipUrl,
    slipUploadedAt: row.slipUploadedAt?.toISOString() ?? null,
    reviewedByAdminId: row.reviewedByAdminId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

import { z } from 'zod';
import {
  idSchema,
  isoDateTimeSchema,
  thbAmountSchema,
  urlSchema,
} from '../common/index';
import { paymentStatusSchema } from '../enums/index';

/**
 * Dynamic PromptPay QR payload for a QR_CODE-branch booking (PRD rev 6,
 * ARCHITECTURE §4.3). Generated per-booking, per payment step from the branch's
 * PromptPay ID + this booking's `amountDue`. NOT a payment gateway — purely
 * pre-fills the amount. `payload` is the raw EMVCo string; `qrImageDataUrl` is a
 * ready-to-render data URL.
 */
export const promptPayQrSchema = z.object({
  payload: z.string(),
  qrImageDataUrl: z.string(),
});
export type PromptPayQr = z.infer<typeof promptPayQrSchema>;

/**
 * Payment (PRD §4). Tracked SEPARATELY from booking status; converges only at
 * Confirmed. `slipUrl` is a short-lived signed GET URL, issued on demand to
 * admins/owner (ARCHITECTURE §4.4) — never a public URL.
 */
export const paymentSchema = z.object({
  id: idSchema,
  bookingId: idSchema,
  status: paymentStatusSchema,
  /** Server-authoritative amount due (THB satang) = priceBreakdown.total. */
  amountDue: thbAmountSchema,

  /** QR_CODE branch: dynamic QR (present while awaiting/at slip upload); else null. */
  qr: promptPayQrSchema.nullable(),
  /** Signed GET URL of the uploaded slip image; null until uploaded. */
  slipUrl: urlSchema.nullable(),
  slipUploadedAt: isoDateTimeSchema.nullable(),

  /** Admin who confirmed/rejected (audit, PRD NFR5e); null for Pay-Onsite/pending. */
  reviewedByAdminId: idSchema.nullable(),
  reviewedAt: isoDateTimeSchema.nullable(),
  /** Reason attached to a rejection, surfaced to the client. */
  rejectionReason: z.string().max(500).nullable(),

  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Payment = z.infer<typeof paymentSchema>;

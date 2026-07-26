/**
 * PromptPayQrService port (ARCHITECTURE §4.3). Called per booking, per
 * payment step (never cached/precomputed per Branch) because the amount is
 * booking-specific — `PaymentService` calls it only once a `Booking` has
 * actually entered `PENDING_PAYMENT` (or, for the polling read path, while
 * still awaiting/under review) with a known amount. Not a payment gateway:
 * it produces a QR, nothing more; confirmation is always the manual Admin
 * action (ARCHITECTURE §6).
 *
 * Bound to `PromptPayAdapter` (wraps `buildPromptPayPayload` from
 * `@repo/domain` + the `qrcode` npm package) via the `PROMPTPAY_QR` DI token
 * in `IntegrationsModule`.
 */
export interface PromptPayQrService {
  generate(input: { promptPayId: string; amountThb: number }): Promise<{ payload: string; qrImageDataUrl: string }>;
}

export const PROMPTPAY_QR = Symbol('PromptPayQrService');

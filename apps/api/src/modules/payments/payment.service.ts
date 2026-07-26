import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  slipUploadUrlResponseSchema,
  slipViewUrlResponseSchema,
  type BookingDetail,
  type ConfirmSlipBody,
  type Payment as PaymentDto,
  type SlipUploadUrlBody,
  type SlipUploadUrlResponse,
  type SlipViewUrlResponse,
} from '@repo/types';
import type { PaymentStatus } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { getTenantId } from '../../prisma/tenant-context';
import { BookingsRepository } from '../bookings/bookings.repository';
import { PromotionCapReachedError } from '../bookings/errors';
import { mapToBookingDetail } from '../bookings/booking.mapper';
import { PaymentsRepository } from './payments.repository';
import { BranchesRepository } from '../branches/branches.repository';
import { ConfigRepository } from '../config/config.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { OBJECT_STORAGE, type ObjectStorage } from '../../integrations/ports/object-storage.port';
import { PROMPTPAY_QR, type PromptPayQrService } from '../../integrations/ports/promptpay-qr.port';
import { mapPayment, QR_ELIGIBLE_PAYMENT_STATUSES, type PaymentRowLike } from './payment.mapper';

/** Signed GET URLs (slip re-view) are short-lived — re-issued on every read,
 * never cached client-side beyond this window (ARCHITECTURE §4.4, NFR5c). */
const SLIP_VIEW_URL_TTL_SECONDS = 5 * 60;
/** Presigned PUT window — generous enough for a client to select + upload a
 * photo from their gallery without racing the URL's own expiry. */
const SLIP_UPLOAD_URL_TTL_SECONDS = 10 * 60;
/** Hard server cap on the slip image size a presigned PUT may be issued for
 * (`slipUploadUrlBodySchema` only requires a positive int — the server owns
 * the ceiling). A payment slip is a phone screenshot; 10 MB is ample and
 * bounds storage abuse once a real S3/R2 adapter is bound. */
const SLIP_MAX_CONTENT_LENGTH_BYTES = 10 * 1024 * 1024;

/** Booking statuses from which an Admin confirm can succeed (ARCHITECTURE
 * §6.1 diagram: PENDING_PAYMENT → CONFIRMED direct/walk-in confirm, no slip;
 * PENDING_PAYMENT_CONFIRMATION → CONFIRMED slip-review confirm). */
const CONFIRMABLE_BOOKING_STATUSES: BookingDetail['status'][] = ['PENDING_PAYMENT', 'PENDING_PAYMENT_CONFIRMATION'];

/**
 * Explicit Payment status machine (ARCHITECTURE §6.2) — `current → allowed
 * next` — enforced on every mutating call below via `assertPaymentTransition`.
 * `CONFIRMED`/`REJECTED`/`PAY_ONSITE_NOT_COLLECTED` are all terminal for this
 * service: in particular `PAY_ONSITE_NOT_COLLECTED` has NO allowed next
 * transition here, which is what makes "Pay-Onsite payments can never be
 * confirmed/rejected/slip-uploaded via this service" true structurally,
 * without a separate branch-type check (though callers also check booking
 * status/branch first, for a clearer error before ever consulting this map —
 * a Pay-Onsite booking never reaches PENDING_PAYMENT/PENDING_PAYMENT_CONFIRMATION
 * in the first place, ARCHITECTURE §6.1).
 */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  AWAITING_SLIP_UPLOAD: ['SLIP_UPLOADED_PENDING_REVIEW', 'CONFIRMED'],
  SLIP_UPLOADED_PENDING_REVIEW: ['CONFIRMED', 'REJECTED'],
  CONFIRMED: [],
  REJECTED: [],
  PAY_ONSITE_NOT_COLLECTED: [],
};

function assertPaymentTransition(current: PaymentStatus, target: PaymentStatus): void {
  if (!PAYMENT_TRANSITIONS[current].includes(target)) {
    throw ApiError.conflict('INVALID_STATE_TRANSITION', `Payment cannot move from ${current} to ${target}`);
  }
}

/**
 * Payment lifecycle orchestration (PRD C3.1, ARCHITECTURE §4.3/§4.4/§6).
 * Owns: the client-facing Payment read (incl. on-demand PromptPay QR +
 * signed slip GET URL), the presigned-PUT slip-upload flow, slip submission,
 * and the (not-yet-HTTP-wired, see `PaymentController`'s TODO) Admin
 * confirm/reject/slip-view operations — all of which delegate their actual
 * Booking/Payment row writes to `BookingsRepository` (ARCHITECTURE §7: ALL
 * writes that set `booking.status = CONFIRMED` live in ONE repository).
 * Never trusts a client-sent amount — every `amountDue` shown here is the
 * server-snapshotted `Payment.amountDue`/`Booking.totalAmount`.
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly payments: PaymentsRepository,
    private readonly branches: BranchesRepository,
    private readonly config: ConfigRepository,
    private readonly audit: AuditLogRepository,
    @Inject(OBJECT_STORAGE) private readonly objectStorage: ObjectStorage,
    @Inject(PROMPTPAY_QR) private readonly promptPayQr: PromptPayQrService,
  ) {}

  /** Client payment detail (PRD C3.1) — fail-closed 404 for a booking the
   * current Member does not own, mirroring `BookingService.getBookingDetail`. */
  async getPayment(bookingId: string, memberId: string): Promise<PaymentDto> {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record || record.memberId !== memberId) {
      throw ApiError.notFound('Booking not found');
    }
    return this.buildPaymentDto(record, record.payment);
  }

  /**
   * Presigned PUT URL for the slip image (PRD C3.1, ARCHITECTURE §4.4 —
   * binary never proxied through the API). Guards: QR_CODE branch,
   * Booking=PENDING_PAYMENT / Payment=AWAITING_SLIP_UPLOAD, hold not expired.
   */
  async getSlipUploadUrl(bookingId: string, memberId: string, body: SlipUploadUrlBody): Promise<SlipUploadUrlResponse> {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record || record.memberId !== memberId) {
      throw ApiError.notFound('Booking not found');
    }
    if (record.branchPaymentMethod !== 'QR_CODE' || !record.payment) {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'Slip upload is only available for QR-Code branch bookings');
    }
    if (record.status !== 'PENDING_PAYMENT') {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'Booking is not awaiting a slip upload');
    }
    assertPaymentTransition(record.payment.status, 'SLIP_UPLOADED_PENDING_REVIEW');
    if (!record.holdExpiresAt || record.holdExpiresAt <= new Date()) {
      throw ApiError.conflict('HOLD_EXPIRED', 'The hold window for this booking has expired');
    }
    if (body.contentLength > SLIP_MAX_CONTENT_LENGTH_BYTES) {
      throw ApiError.validation('Slip image exceeds the maximum allowed size', {
        maxContentLength: SLIP_MAX_CONTENT_LENGTH_BYTES,
      });
    }

    const objectKey = `tenants/${getTenantId()}/slips/${bookingId}/${randomUUID()}`;
    const presigned = await this.objectStorage.createPresignedPutUrl({
      objectKey,
      contentType: body.contentType,
      contentLength: body.contentLength,
      expiresInSeconds: SLIP_UPLOAD_URL_TTL_SECONDS,
    });

    return slipUploadUrlResponseSchema.parse({
      uploadUrl: presigned.uploadUrl,
      objectKey,
      requiredHeaders: presigned.requiredHeaders,
      expiresAt: presigned.expiresAt.toISOString(),
    });
  }

  /**
   * Confirm the slip was uploaded (PRD C3.1 AC2) — Booking →
   * PENDING_PAYMENT_CONFIRMATION, Payment → SLIP_UPLOADED_PENDING_REVIEW,
   * atomically (`BookingsRepository.submitSlip`). Same guards as
   * `getSlipUploadUrl`.
   */
  async submitSlip(bookingId: string, memberId: string, body: ConfirmSlipBody): Promise<BookingDetail> {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record || record.memberId !== memberId) {
      throw ApiError.notFound('Booking not found');
    }
    if (record.branchPaymentMethod !== 'QR_CODE' || !record.payment) {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'Slip upload is only available for QR-Code branch bookings');
    }
    if (record.status !== 'PENDING_PAYMENT') {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'Booking is not awaiting a slip upload');
    }
    assertPaymentTransition(record.payment.status, 'SLIP_UPLOADED_PENDING_REVIEW');
    if (!record.holdExpiresAt || record.holdExpiresAt <= new Date()) {
      throw ApiError.conflict('HOLD_EXPIRED', 'The hold window for this booking has expired');
    }
    // The upload URL was issued for a server-chosen, tenant+booking-scoped key
    // (`getSlipUploadUrl`). Never persist an arbitrary client-supplied path —
    // otherwise a member could point this booking's slip at any object in the
    // bucket (the signed-GET issuance later trusts whatever key is stored).
    const expectedPrefix = `tenants/${getTenantId()}/slips/${bookingId}/`;
    if (!body.objectKey.startsWith(expectedPrefix)) {
      throw ApiError.validation('Slip object key does not match the issued upload key for this booking');
    }

    const result = await this.bookings.submitSlip({ bookingId, slipObjectKey: body.objectKey });

    await this.audit.record({
      actorType: 'MEMBER',
      actorId: memberId,
      action: 'PAYMENT_SLIP_SUBMITTED',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { objectKey: body.objectKey },
    });

    return this.toBookingDetail(result.booking, result.payment, record.member);
  }

  // TODO(M8/M9): wire /admin/bookings/{id}/payment/{confirm,reject,slip-url}
  // controller behind AdminSessionGuard+RolesGuard — the three methods below
  // are already fully unit-testable service-layer implementations.

  /**
   * Admin confirm (slip review OR direct/walk-in confirm, PRD A2.3 AC2 /
   * A2.2 AC3, ARCHITECTURE §6) — delegates the atomic write to
   * `BookingsRepository.confirmPayment` (booking CONFIRMED + promo
   * redemption-if-any + payment CONFIRMED, one transaction). 409
   * INVALID_STATE_TRANSITION if the booking isn't in a confirmable state
   * (e.g. a Pay-Onsite booking, already CONFIRMED via auto-confirm; or a
   * terminal booking).
   */
  async adminConfirmPayment(bookingId: string, adminId: string, note?: string): Promise<BookingDetail> {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record) throw ApiError.notFound('Booking not found');
    if (!CONFIRMABLE_BOOKING_STATUSES.includes(record.status) || !record.payment) {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'Booking is not awaiting payment confirmation');
    }
    assertPaymentTransition(record.payment.status, 'CONFIRMED');

    let result;
    try {
      result = await this.bookings.confirmPayment({ bookingId, adminId, note });
    } catch (err) {
      if (err instanceof PromotionCapReachedError) {
        throw ApiError.conflict('PROMO_NOT_APPLICABLE', 'This promo code is no longer available');
      }
      throw err;
    }

    await this.audit.record({
      actorType: 'ADMIN',
      actorId: adminId,
      action: 'PAYMENT_CONFIRMED',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: note ? { note } : undefined,
    });

    return this.toBookingDetail(result.booking, result.payment, record.member);
  }

  /**
   * Admin reject (PRD A2.3 AC3, ARCHITECTURE §5.2/§6) — delegates to
   * `BookingsRepository.rejectPayment` (booking REJECTED + grid released +
   * payment REJECTED, one transaction). 409 if the booking isn't currently
   * `PENDING_PAYMENT_CONFIRMATION`.
   */
  async adminRejectPayment(bookingId: string, adminId: string, reason: string): Promise<BookingDetail> {
    const record = await this.bookings.findByIdWithPayment(bookingId);
    if (!record) throw ApiError.notFound('Booking not found');
    if (record.status !== 'PENDING_PAYMENT_CONFIRMATION' || !record.payment) {
      throw ApiError.conflict('INVALID_STATE_TRANSITION', 'Only a slip pending review can be rejected');
    }
    assertPaymentTransition(record.payment.status, 'REJECTED');

    const result = await this.bookings.rejectPayment({ bookingId, adminId, reason });

    await this.audit.record({
      actorType: 'ADMIN',
      actorId: adminId,
      action: 'PAYMENT_REJECTED',
      entityType: 'Booking',
      entityId: bookingId,
      metadata: { reason },
    });

    return this.toBookingDetail(result.booking, result.payment, record.member);
  }

  /** Admin slip re-view (PRD A2.3 AC4, ARCHITECTURE §4.4) — short-lived
   * signed GET URL; 404 if no slip has been uploaded. */
  async issueSlipViewUrl(bookingId: string): Promise<SlipViewUrlResponse> {
    const payment = await this.payments.findByBookingId(bookingId);
    if (!payment || !payment.slipObjectKey) {
      throw ApiError.notFound('No slip uploaded for this booking');
    }
    const signed = await this.objectStorage.createSignedGetUrl({
      objectKey: payment.slipObjectKey,
      expiresInSeconds: SLIP_VIEW_URL_TTL_SECONDS,
    });
    return slipViewUrlResponseSchema.parse({ slipUrl: signed.url, expiresAt: signed.expiresAt.toISOString() });
  }

  /** Shared `BookingDetail` assembly (re-fetches `Config.cancellationCutoffHours`,
   * mirrors every other mutating method in `BookingService`). */
  private async toBookingDetail(
    booking: Parameters<typeof mapToBookingDetail>[0],
    payment: Parameters<typeof mapToBookingDetail>[1],
    member: Parameters<typeof mapToBookingDetail>[2],
  ): Promise<BookingDetail> {
    const config = await this.config.get();
    return mapToBookingDetail(booking, payment, member, {
      now: new Date(),
      cancellationCutoffHours: config?.cancellationCutoffHours ?? 2,
    });
  }

  /**
   * Assemble the client-facing `Payment` DTO, generating `qr` (QR_CODE
   * branch, only while the payment is still QR-eligible, ARCHITECTURE §4.3 —
   * "per booking, per payment step", never cached/precomputed) and `slipUrl`
   * (signed GET, only once a slip has actually been uploaded) via the
   * injected integration ports. Handles the provisional (no `Payment` row
   * yet, still `PENDING_VERIFICATION`) case identically to
   * `booking.mapper.ts`'s `mapPayment`.
   */
  private async buildPaymentDto(
    booking: {
      id: string;
      branchId: string;
      branchPaymentMethod: 'QR_CODE' | 'PAY_ONSITE';
      totalAmount: number;
      createdAt: Date;
      updatedAt: Date;
    },
    payment: {
      id: string;
      bookingId: string;
      status: PaymentStatus;
      amountDue: number;
      slipObjectKey: string | null;
      slipUploadedAt: Date | null;
      reviewedByAdminId: string | null;
      reviewedAt: Date | null;
      rejectionReason: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null,
  ): Promise<PaymentDto> {
    const row: PaymentRowLike = payment
      ? {
          id: payment.id,
          bookingId: payment.bookingId,
          status: payment.status,
          amountDue: payment.amountDue,
          slipUploadedAt: payment.slipUploadedAt,
          reviewedByAdminId: payment.reviewedByAdminId,
          reviewedAt: payment.reviewedAt,
          rejectionReason: payment.rejectionReason,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        }
      : {
          id: booking.id,
          bookingId: booking.id,
          status: booking.branchPaymentMethod === 'QR_CODE' ? 'AWAITING_SLIP_UPLOAD' : 'PAY_ONSITE_NOT_COLLECTED',
          amountDue: booking.totalAmount,
          slipUploadedAt: null,
          reviewedByAdminId: null,
          reviewedAt: null,
          rejectionReason: null,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        };

    let qr = null;
    if (booking.branchPaymentMethod === 'QR_CODE' && QR_ELIGIBLE_PAYMENT_STATUSES.includes(row.status)) {
      const branch = await this.branches.findById(booking.branchId);
      if (branch?.promptPayId) {
        qr = await this.promptPayQr.generate({ promptPayId: branch.promptPayId, amountThb: row.amountDue });
      }
    }

    let slipUrl: string | null = null;
    if (payment?.slipObjectKey) {
      const signed = await this.objectStorage.createSignedGetUrl({
        objectKey: payment.slipObjectKey,
        expiresInSeconds: SLIP_VIEW_URL_TTL_SECONDS,
      });
      slipUrl = signed.url;
    }

    return mapPayment(row, { qr, slipUrl });
  }
}

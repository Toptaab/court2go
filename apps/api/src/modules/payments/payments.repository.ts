import { Injectable } from '@nestjs/common';
import { Payment, PaymentStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/**
 * Payment (PRD §4) — 1:1 with Booking, tracked as a SEPARATE state machine
 * (ARCHITECTURE §6.2). This repository never writes `Booking.status` itself
 * — every transition that touches both rows (e.g. admin confirm) is
 * orchestrated by `PaymentService` calling both this repository and
 * `BookingsRepository.transitionStatus` inside the SAME `withTenant`
 * transaction (so the DB trigger's deferred convergence check — §5 of the
 * initial migration — sees the final, consistent state of both rows).
 */
@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByBookingId(bookingId: string): Promise<Payment | null> {
    return this.prisma.withTenant((tx) => tx.payment.findUnique({ where: { bookingId } }));
  }

  /** Created alongside the Booking transition out of PENDING_VERIFICATION
   * (either AWAITING_SLIP_UPLOAD for QR_CODE, or PAY_ONSITE_NOT_COLLECTED
   * for Pay-Onsite, ARCHITECTURE §6.1) — always inside the same transaction
   * as that Booking status update. */
  create(data: {
    bookingId: string;
    status: PaymentStatus;
    amountDue: number;
    qrPayload?: string | null;
  }): Promise<Payment> {
    return this.prisma.withTenant((tx) => tx.payment.create({ data: { tenantId: getTenantId(), ...data } }));
  }

  recordSlipUpload(bookingId: string, slipObjectKey: string): Promise<Payment> {
    return this.prisma.withTenant((tx) =>
      tx.payment.update({
        where: { bookingId },
        data: { status: 'SLIP_UPLOADED_PENDING_REVIEW', slipObjectKey, slipUploadedAt: new Date() },
      }),
    );
  }

  /** Admin confirm (slip review OR direct walk-in confirm, PRD A2.3 AC2 / A2.2 AC3). */
  confirm(bookingId: string, adminId: string, note?: string): Promise<Payment> {
    return this.prisma.withTenant((tx) =>
      tx.payment.update({
        where: { bookingId },
        data: {
          status: 'CONFIRMED',
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
          rejectionReason: note ? null : undefined,
        },
      }),
    );
  }

  /** Admin reject (PRD A2.3 AC3) — grid release is the caller's
   * responsibility via `BookingsRepository.transitionStatus(bookingId, 'REJECTED')`. */
  reject(bookingId: string, adminId: string, reason: string): Promise<Payment> {
    return this.prisma.withTenant((tx) =>
      tx.payment.update({
        where: { bookingId },
        data: { status: 'REJECTED', reviewedByAdminId: adminId, reviewedAt: new Date(), rejectionReason: reason },
      }),
    );
  }

  /** Admin review queue (PRD A2.3 AC4) — all QR_CODE bookings currently
   * awaiting a human decision, scoped further by the caller (branch, etc.)
   * via `BookingsRepository.listForAdmin({ paymentStatus: ... })` on the
   * Booking side; this helper is for a Payment-first query shape. */
  listAwaitingReview(): Promise<Payment[]> {
    return this.prisma.withTenant((tx) =>
      tx.payment.findMany({ where: { status: 'SLIP_UPLOADED_PENDING_REVIEW' }, orderBy: { slipUploadedAt: 'asc' } }),
    );
  }
}

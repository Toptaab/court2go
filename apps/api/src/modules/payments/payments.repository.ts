import { Injectable } from '@nestjs/common';
import { Payment } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Payment (PRD §4) — 1:1 with Booking, tracked as a SEPARATE state machine
 * (ARCHITECTURE §6.2). This is a READ-ONLY repository. Every write that
 * touches both the Payment row and `Booking.status` — slip submit, admin
 * confirm, admin reject — MUST be a single atomic `withTenant` transaction,
 * and those all live in `BookingsRepository`
 * (`submitSlip`/`confirmPayment`/`rejectPayment`) alongside
 * `advanceOutOfVerification`, so there is exactly one authoritative writer for
 * the money path (M7 invariant — a cross-repository, two-transaction write
 * cannot be atomic). Do NOT add Payment writers here.
 */
@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByBookingId(bookingId: string): Promise<Payment | null> {
    return this.prisma.withTenant((tx) => tx.payment.findUnique({ where: { bookingId } }));
  }
}

import { Module } from '@nestjs/common';
import { BookingsRepository } from '../bookings/bookings.repository';
import { PromotionsRepository } from '../promotions/promotions.repository';
import { BranchesRepository } from '../branches/branches.repository';
import { MembersRepository } from '../members/members.repository';
import { ConfigRepository } from '../config/config.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { ClientSessionsRepository } from '../auth-member/client-sessions.repository';
import { MemberSessionGuard } from '../auth-member/member-session.guard';
import { PaymentsRepository } from './payments.repository';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

/**
 * Payment module (PRD C3.1, ARCHITECTURE §4.3/§4.4/§6). Mirrors
 * `BookingsModule`'s local-provider pattern: `MemberSessionGuard` +
 * `ClientSessionsRepository` are re-provided here (not imported wholesale)
 * so this module stays self-contained. `BookingsRepository` is re-provided
 * too — it is the SOLE writer of `Booking.status = CONFIRMED`/`REJECTED`
 * transitions relevant here (ARCHITECTURE §7), so `PaymentService` composes
 * it rather than duplicating any booking-status write locally.
 * `PromotionsRepository` is provided for parity with `BookingsModule` even
 * though `PaymentService` doesn't call it directly today — QR-branch promo
 * redemption at admin-confirm time is performed entirely inside
 * `BookingsRepository.confirmPayment` (the booking row already carries
 * `appliedPromotionId`/`promotionDiscountAmount`, so no separate promotion
 * lookup is needed at this layer).
 */
@Module({
  controllers: [PaymentController],
  providers: [
    PaymentService,
    BookingsRepository,
    PaymentsRepository,
    BranchesRepository,
    MembersRepository,
    PromotionsRepository,
    ConfigRepository,
    AuditLogRepository,
    ClientSessionsRepository,
    MemberSessionGuard,
  ],
  // Exported so M9's admin booking controllers wire the already-tested admin
  // payment confirm/reject/slip-url methods behind the RBAC guards.
  exports: [PaymentService],
})
export class PaymentsModule {}

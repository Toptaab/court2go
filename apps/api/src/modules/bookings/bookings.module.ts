import { Module } from '@nestjs/common';
import { BookingsRepository } from './bookings.repository';
import { PromotionsRepository } from '../promotions/promotions.repository';
import { CourtsRepository } from '../courts/courts.repository';
import { ConfigRepository } from '../config/config.repository';
import { MembersRepository } from '../members/members.repository';
import { BranchesRepository } from '../branches/branches.repository';
import { SportsRepository } from '../sports/sports.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { ClientSessionsRepository } from '../auth-member/client-sessions.repository';
import { MemberSessionGuard } from '../auth-member/member-session.guard';
import { BookingService } from './booking.service';
import { HoldsController } from './holds.controller';
import { BookingsController } from './bookings.controller';
import { MeBookingsController } from './me-bookings.controller';
import { HoldExpiryJob } from '../../jobs/hold-expiry.job';

/**
 * Booking + Hold lifecycle module (PRD C1.2/C4.2/C4.3, ARCHITECTURE §5/§6).
 * `MemberSessionGuard` depends on `ClientSessionsRepository` — both are
 * re-provided here rather than importing `AuthMemberModule` wholesale
 * (Nest module providers are per-module, mirroring `MembersModule`'s own
 * comment on the same pattern). `PromotionsRepository` is provided here even
 * though M6 doesn't add its own controller, since `BookingService` composes it
 * for the promo-apply flow. (Payments are written via `BookingsRepository`'s
 * composed transactions in M6; `PaymentsRepository` lands with M7.)
 */
@Module({
  controllers: [HoldsController, BookingsController, MeBookingsController],
  providers: [
    BookingService,
    BookingsRepository,
    PromotionsRepository,
    CourtsRepository,
    ConfigRepository,
    MembersRepository,
    BranchesRepository,
    SportsRepository,
    AuditLogRepository,
    ClientSessionsRepository,
    MemberSessionGuard,
    HoldExpiryJob,
  ],
  // Exported so M9's `AdminBookingsModule` reuses the authoritative walk-in /
  // modify pipeline (`createWalkIn`/`adminModify`) instead of duplicating the
  // grid-validation + pricing logic.
  exports: [BookingService, BookingsRepository, ConfigRepository, AuditLogRepository],
})
export class BookingsModule {}

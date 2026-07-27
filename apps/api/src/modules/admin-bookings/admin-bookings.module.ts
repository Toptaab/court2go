import { Module } from '@nestjs/common';
import { AuthAdminModule } from '../auth-admin/auth-admin.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsModule } from '../payments/payments.module';
import { CourtsRepository } from '../courts/courts.repository';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminBookingsController } from './admin-bookings.controller';

/**
 * Admin booking console (PRD A1/A2, M9). Imports `BookingsModule` (reuses the
 * authoritative `BookingService.createWalkIn`/`adminModify` pipeline +
 * `BookingsRepository`/`ConfigRepository`/`AuditLogRepository`), `PaymentsModule`
 * (the M7 admin payment confirm/reject/slip-url methods), and `AuthAdminModule`
 * (RBAC guards). `CourtsRepository` is provided locally for the walk-in /
 * modify branch-scope court lookups (module-local repository pattern).
 */
@Module({
  imports: [AuthAdminModule, BookingsModule, PaymentsModule],
  controllers: [AdminBookingsController],
  providers: [AdminBookingsService, CourtsRepository],
})
export class AdminBookingsModule {}

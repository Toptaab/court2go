import { Module } from '@nestjs/common';
import { CourtsRepository } from '../courts/courts.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import { ConfigRepository } from '../config/config.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

/**
 * Availability (PRD C1.2) — public read-only start-time grid per court/date.
 * Repositories are provided here (stateless), mirroring `PublicModule`.
 * `AuditLogRepository` is provided purely to satisfy `BookingsRepository`'s
 * constructor (used by its guarded `declineCancellationRequest`) — this
 * module never calls it directly.
 */
@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, CourtsRepository, BookingsRepository, ConfigRepository, AuditLogRepository],
})
export class AvailabilityModule {}

import { Module } from '@nestjs/common';
import { CourtsRepository } from '../courts/courts.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import { ConfigRepository } from '../config/config.repository';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

/**
 * Availability (PRD C1.2) — public read-only start-time grid per court/date.
 * Repositories are provided here (stateless), mirroring `PublicModule`.
 */
@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, CourtsRepository, BookingsRepository, ConfigRepository],
})
export class AvailabilityModule {}

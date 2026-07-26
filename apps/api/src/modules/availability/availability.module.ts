import { Module } from '@nestjs/common';
import { BookingsRepository } from '../bookings/bookings.repository';
import { CourtsRepository } from '../courts/courts.repository';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

/**
 * Public per-court availability grid (PRD C1.2, M4). Provides its own
 * repository instances (stateless, same pattern as `PublicModule`) rather
 * than sharing a global provider.
 */
@Module({
  controllers: [AvailabilityController],
  providers: [CourtsRepository, BookingsRepository, AvailabilityService],
})
export class AvailabilityModule {}

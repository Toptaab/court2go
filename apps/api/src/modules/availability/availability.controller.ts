import { Controller, Get, Param, Query } from '@nestjs/common';
import { type AvailabilityQuery, type AvailabilityResponse, availabilityQuerySchema } from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AvailabilityService } from './availability.service';

/**
 * Public, read-only, tenant-header-scoped availability grid (PRD C1.1/C1.2).
 * No member session required.
 */
@Controller()
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get('courts/:courtId/availability')
  async getAvailability(
    @Param('courtId') courtId: string,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ): Promise<AvailabilityResponse> {
    return this.availability.computeAvailability(courtId, query.date);
  }
}

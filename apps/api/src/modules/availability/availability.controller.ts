import { Controller, Get, Param, Query } from '@nestjs/common';
import { availabilityQuerySchema, type AvailabilityQuery, type AvailabilityResponse } from '@repo/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AvailabilityService } from './availability.service';

/**
 * Public availability read (PRD C1.2) — tenant-scoped via `x-tenant-id`
 * (`TenantContextMiddleware` → RLS), unauthenticated.
 */
@Controller()
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get('courts/:courtId/availability')
  async getAvailability(
    @Param('courtId') courtId: string,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ): Promise<AvailabilityResponse> {
    return this.availability.getAvailability(courtId, query);
  }
}

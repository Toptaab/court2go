import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import type { PublicTenant } from '@repo/types';
import { ApiError } from '../../common/api-error';
import { runWithTenant } from '../../prisma/tenant-context';
import { TenantsRepository } from '../tenants/tenants.repository';
import { ConfigRepository } from '../config/config.repository';
import { toBranding } from './catalog.mappers';

/**
 * `GET /tenants/by-slug/{slug}` — the one unauthenticated tenant-resolution
 * call the web shell bootstraps with (ARCHITECTURE §2.2). No `x-tenant-id`
 * header (the slug IS the lookup key), so `TenantsRepository` uses the raw,
 * unscoped client; the follow-up config read is wrapped in an explicit tenant
 * context so RLS still applies to it.
 */
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenants: TenantsRepository,
    private readonly config: ConfigRepository,
  ) {}

  @Get('by-slug/:slug')
  async bySlug(@Param('slug') slug: string): Promise<PublicTenant> {
    const tenant = await this.tenants.findBySlug(slug);
    if (!tenant) throw ApiError.notFound('Tenant not found', 'TENANT_NOT_FOUND');

    const config = await runWithTenant(tenant.id, () => this.config.get());
    if (!config) {
      // A provisioned tenant always has a Config row (seed invariant); a
      // missing one is a server misprovisioning, not a client 404.
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Tenant is missing configuration');
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      branding: toBranding(tenant),
      publicConfig: {
        holdWindowMinutes: config.holdWindowMinutes as 5 | 10,
        minBookingLeadTimeMinutes: config.minBookingLeadTimeMinutes,
        maxAdvanceBookingDays: config.maxAdvanceBookingDays,
        cancellationCutoffHours: config.cancellationCutoffHours,
      },
    };
  }
}

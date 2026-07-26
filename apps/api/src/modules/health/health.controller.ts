import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Liveness + readiness. `/health` is tenant-agnostic (not covered by
 * TenantContextMiddleware) — used by the container host / load balancer.
 * Readiness runs a trivial DB round-trip so a broken DB connection surfaces
 * as 503-shaped (the query throws → 500 envelope) rather than a false green.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok'; db: 'up'; ts: string }> {
    await this.prisma.raw().$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'up', ts: new Date().toISOString() };
  }
}

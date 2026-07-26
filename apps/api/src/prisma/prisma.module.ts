import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so every feature module can inject `PrismaService` (and repositories
 * built on it) without re-importing. Tenant scoping is enforced per-query
 * inside `PrismaService.withTenant`, not by module boundaries.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

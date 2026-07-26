import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { TenantContextMiddleware } from './common/tenant-context.middleware';
import { TenantsRepository } from './modules/tenants/tenants.repository';
import { HealthController } from './modules/health/health.controller';
import { PublicModule } from './modules/public/public.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AuthMemberModule } from './modules/auth-member/auth-member.module';
import { MembersModule } from './modules/members/members.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';

/**
 * Root module. Feature modules (catalog, availability, auth, bookings,
 * payments, admin) are added per milestone (docs/PLAN.md). `TenantsRepository`
 * lives here (not a feature module) because the tenant middleware needs it
 * before any feature module resolves. `ScheduleModule.forRoot()` powers the
 * hold-expiry background sweeper (`jobs/hold-expiry.job.ts`, ARCHITECTURE §5.3).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    IntegrationsModule,
    PublicModule,
    AuthMemberModule,
    MembersModule,
    AvailabilityModule,
    BookingsModule,
  ],
  controllers: [HealthController],
  providers: [TenantsRepository, TenantContextMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Applies to everything EXCEPT /health (tenant-agnostic). As scoped
    // feature routes land, they inherit this automatically.
    consumer
      .apply(TenantContextMiddleware)
      .exclude({ path: 'health', method: RequestMethod.ALL })
      .forRoutes('*');
  }
}

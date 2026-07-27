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
import { AuthAdminModule } from './modules/auth-admin/auth-admin.module';
import { MembersModule } from './modules/members/members.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminBookingsModule } from './modules/admin-bookings/admin-bookings.module';
import { AdminCatalogModule } from './modules/admin-catalog/admin-catalog.module';
import { AdminPromotionsModule } from './modules/admin-promotions/admin-promotions.module';
import { AdminNewsModule } from './modules/admin-news/admin-news.module';
import { AdminMembersModule } from './modules/admin-members/admin-members.module';
import { AdminConfigModule } from './modules/admin-config/admin-config.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';

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
    AuthAdminModule,
    MembersModule,
    AvailabilityModule,
    BookingsModule,
    PaymentsModule,
    AdminBookingsModule,
    AdminCatalogModule,
    AdminPromotionsModule,
    AdminNewsModule,
    AdminMembersModule,
    AdminConfigModule,
    AdminUsersModule,
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

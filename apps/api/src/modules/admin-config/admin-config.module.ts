import { Module } from '@nestjs/common';
import { AuthAdminModule } from '../auth-admin/auth-admin.module';
import { ConfigRepository } from '../config/config.repository';
import { TenantsRepository } from '../tenants/tenants.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { AdminConfigService } from './admin-config.service';
import { AdminConfigController } from './admin-config.controller';

/** Admin config / branding / uploads (PRD A8, M9). `OBJECT_STORAGE` comes from
 * the @Global `IntegrationsModule`. */
@Module({
  imports: [AuthAdminModule],
  controllers: [AdminConfigController],
  providers: [AdminConfigService, ConfigRepository, TenantsRepository, AuditLogRepository],
})
export class AdminConfigModule {}

import { Module } from '@nestjs/common';
import { AuthAdminModule } from '../auth-admin/auth-admin.module';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';

/**
 * AdminUser management + roles matrix (PRD A9, M9). `AdminUsersRepository` +
 * `AdminSessionsRepository` come from the imported `AuthAdminModule` (it
 * already provides + exports both).
 */
@Module({
  imports: [AuthAdminModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, AuditLogRepository],
})
export class AdminUsersModule {}

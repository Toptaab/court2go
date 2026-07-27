import { Module } from '@nestjs/common';
import { AuthAdminModule } from '../auth-admin/auth-admin.module';
import { BranchesRepository } from '../branches/branches.repository';
import { SportsRepository } from '../sports/sports.repository';
import { CourtsRepository } from '../courts/courts.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminBranchesController } from './admin-branches.controller';
import { AdminSportsController } from './admin-sports.controller';
import { AdminCourtsController } from './admin-courts.controller';

/** Admin catalog CRUD (PRD A3/A4/A5). Provides its own domain repositories
 * (module-local pattern) + imports `AuthAdminModule` for the RBAC guards. */
@Module({
  imports: [AuthAdminModule],
  controllers: [AdminBranchesController, AdminSportsController, AdminCourtsController],
  providers: [AdminCatalogService, BranchesRepository, SportsRepository, CourtsRepository, AuditLogRepository],
})
export class AdminCatalogModule {}

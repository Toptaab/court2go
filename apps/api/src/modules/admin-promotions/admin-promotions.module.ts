import { Module } from '@nestjs/common';
import { AuthAdminModule } from '../auth-admin/auth-admin.module';
import { PromotionsRepository } from '../promotions/promotions.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { AdminPromotionsService } from './admin-promotions.service';
import { AdminPromotionsController } from './admin-promotions.controller';

/** Admin promotion management (PRD A6, M9). */
@Module({
  imports: [AuthAdminModule],
  controllers: [AdminPromotionsController],
  providers: [AdminPromotionsService, PromotionsRepository, AuditLogRepository],
})
export class AdminPromotionsModule {}

import { Module } from '@nestjs/common';
import { AuthAdminModule } from '../auth-admin/auth-admin.module';
import { NewsRepository } from '../news/news.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { AdminNewsService } from './admin-news.service';
import { AdminNewsController } from './admin-news.controller';

/** Admin news management (PRD A10, M9). */
@Module({
  imports: [AuthAdminModule],
  controllers: [AdminNewsController],
  providers: [AdminNewsService, NewsRepository, AuditLogRepository],
})
export class AdminNewsModule {}

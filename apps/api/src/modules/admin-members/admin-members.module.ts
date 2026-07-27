import { Module } from '@nestjs/common';
import { AuthAdminModule } from '../auth-admin/auth-admin.module';
import { MembersRepository } from '../members/members.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { ClientSessionsRepository } from '../auth-member/client-sessions.repository';
import { AdminMembersService } from './admin-members.service';
import { AdminMembersController } from './admin-members.controller';

/** Admin Member Management (PRD A7, M9). */
@Module({
  imports: [AuthAdminModule],
  controllers: [AdminMembersController],
  providers: [
    AdminMembersService,
    MembersRepository,
    BookingsRepository,
    AuditLogRepository,
    ClientSessionsRepository,
  ],
})
export class AdminMembersModule {}

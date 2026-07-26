import { Module } from '@nestjs/common';
import { AdminUsersRepository } from '../admin-users/admin-users.repository';
import { AdminSessionsRepository } from './admin-sessions.repository';
import { AuthAdminService } from './auth-admin.service';
import { AuthAdminController } from './auth-admin.controller';
import { AdminSessionGuard } from './admin-session.guard';
import { RolesGuard } from './roles.guard';
import { BranchScopeGuard } from './branch-scope';

/**
 * Admin auth module (ADR-0005, ARCHITECTURE §3.3). Exports the guards + both
 * repositories + the service so M9's admin feature modules (admin-users CRUD,
 * admin-bookings queue, etc.) can guard their own routes and enforce RBAC /
 * branch scope without redeclaring any of this — mirrors `AuthMemberModule`'s
 * DI/export style.
 */
@Module({
  controllers: [AuthAdminController],
  providers: [
    AdminUsersRepository,
    AdminSessionsRepository,
    AuthAdminService,
    AdminSessionGuard,
    RolesGuard,
    BranchScopeGuard,
  ],
  exports: [AdminSessionGuard, RolesGuard, BranchScopeGuard, AdminSessionsRepository, AdminUsersRepository, AuthAdminService],
})
export class AuthAdminModule {}

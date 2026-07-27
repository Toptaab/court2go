import { Injectable } from '@nestjs/common';
import {
  rolesMatrixSchema,
  type AdminUser as AdminUserDto,
  type CreateAdminUserBody,
  type RolesMatrix,
  type UpdateAdminUserBody,
} from '@repo/types';
import type { AdminUser, Role } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { hashPassword } from '../auth-admin/admin-password.util';
import { mapAdminUserToDto } from '../auth-admin/admin.mapper';
import { AdminUsersRepository } from './admin-users.repository';
import { AdminSessionsRepository } from '../auth-admin/admin-sessions.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { ROLES_MATRIX } from './roles-matrix';

/**
 * AdminUser management (PRD A9, ADR-0005). Role-immunity rules enforced HERE
 * (not the repository): OWNER targets are immutable via the API; an ADMIN
 * target may only be removed by the OWNER. Deactivating an admin revokes their
 * live sessions immediately (fail-closed access removal).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly adminUsers: AdminUsersRepository,
    private readonly sessions: AdminSessionsRepository,
    private readonly audit: AuditLogRepository,
  ) {}

  async list(): Promise<AdminUserDto[]> {
    return (await this.adminUsers.list()).map(mapAdminUserToDto);
  }

  async create(actor: AdminUser, body: CreateAdminUserBody): Promise<AdminUserDto> {
    const existing = await this.adminUsers.findByEmail(body.email);
    if (existing) {
      throw ApiError.validation('An admin with this email already exists', { fieldErrors: { email: ['duplicate'] } });
    }
    const created = await this.adminUsers.create({
      email: body.email,
      passwordHash: hashPassword(body.password),
      name: body.name,
      role: body.role as Exclude<Role, 'OWNER'>,
      branchId: body.branchId ?? null,
    });
    await this.record(actor, 'ADMIN_USER_CREATED', created.id);
    return mapAdminUserToDto(created);
  }

  async update(actor: AdminUser, id: string, body: UpdateAdminUserBody): Promise<AdminUserDto> {
    const target = await this.adminUsers.findById(id);
    if (!target) throw ApiError.notFound('Admin user not found');
    if (target.role === 'OWNER') {
      throw ApiError.forbidden('The Owner account cannot be modified via the API', 'OWNER_IMMUTABLE');
    }

    const nextRole = (body.role ?? target.role) as Exclude<Role, 'OWNER'>;
    const nextBranchId = body.branchId !== undefined ? body.branchId : target.branchId;
    if (nextRole === 'BRANCH_ADMIN' && !nextBranchId) {
      throw ApiError.validation('branchId is required for a Branch Admin', { fieldErrors: { branchId: ['required'] } });
    }

    // Deactivating an Admin is functionally a removal (revokes their sessions),
    // so it carries the same "only the Owner may do this to an Admin" guard as
    // `remove` — otherwise a plain Admin could disable a peer Admin via `update`.
    if (body.isActive === false && target.role === 'ADMIN' && actor.role !== 'OWNER') {
      throw ApiError.forbidden('Only the Owner can deactivate an Admin', 'FORBIDDEN');
    }

    // On any transition to ADMIN, always clear branchId (an org-level Admin has
    // no branch), even when the request omits branchId — otherwise a promoted
    // ex-Branch-Admin keeps a stale branchId.
    const clearBranchOnAdmin = nextRole === 'ADMIN';
    const updated = await this.adminUsers.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.role !== undefined ? { role: nextRole } : {}),
      ...(clearBranchOnAdmin
        ? { branchId: null }
        : body.branchId !== undefined
          ? { branchId: nextBranchId }
          : {}),
      ...(body.password !== undefined ? { passwordHash: hashPassword(body.password) } : {}),
    });

    let result = updated;
    if (body.isActive !== undefined && body.isActive !== target.isActive) {
      result = await this.adminUsers.setActive(id, body.isActive);
      if (!body.isActive) await this.sessions.revokeAllForAdminUser(id);
    }

    await this.record(actor, 'ADMIN_USER_UPDATED', id);
    return mapAdminUserToDto(result);
  }

  async remove(actor: AdminUser, id: string): Promise<void> {
    const target = await this.adminUsers.findById(id);
    if (!target) throw ApiError.notFound('Admin user not found');
    if (target.role === 'OWNER') {
      throw ApiError.forbidden('The Owner account cannot be removed', 'OWNER_IMMUTABLE');
    }
    if (target.role === 'ADMIN' && actor.role !== 'OWNER') {
      throw ApiError.forbidden('Only the Owner can remove an Admin', 'FORBIDDEN');
    }
    // Soft-remove: deactivate + revoke sessions (AdminUser has no hard delete).
    await this.adminUsers.setActive(id, false);
    await this.sessions.revokeAllForAdminUser(id);
    await this.record(actor, 'ADMIN_USER_REMOVED', id);
  }

  rolesMatrix(): RolesMatrix {
    return rolesMatrixSchema.parse(ROLES_MATRIX);
  }

  private record(actor: AdminUser, action: string, entityId: string) {
    return this.audit.record({ actorType: 'ADMIN', actorId: actor.id, action, entityType: 'AdminUser', entityId });
  }
}

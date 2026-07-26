import { HttpStatus, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import {
  adminSessionResponseSchema,
  type AdminLoginBody,
  type AdminSessionResponse,
  type AdminUser as AdminUserDto,
} from '@repo/types';
import type { AdminUser } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { isDevLikeEnv } from '../../common/env';
import { AdminUsersRepository } from '../admin-users/admin-users.repository';
import { mapAdminUserToDto } from './admin.mapper';
import { AdminSessionsRepository } from './admin-sessions.repository';
import { ADMIN_SESSION_COOKIE } from './admin-session.guard';
import { verifyPassword } from './admin-password.util';

/**
 * AdminSession duration (ARCHITECTURE §3.3, §9 flag #4). Unlike Member
 * sessions, there is NO `Config` field for this (Member uses
 * `Config.clientSessionDurationDays`) — this is a filled contract gap: a
 * fixed, documented module constant is used instead of a per-tenant setting,
 * since the contract/schema currently has no field to read one from.
 */
export const ADMIN_SESSION_DURATION_DAYS = 7;

/**
 * Admin auth orchestration (ADR-0005, ARCHITECTURE §3.3): email+password
 * login, terminating in a DB-backed `AdminSession` + `Set-Cookie
 * c2g_admin_session`; logout revokes the session; `me` maps the current
 * AdminUser to the contract DTO.
 */
@Injectable()
export class AuthAdminService {
  constructor(
    private readonly adminUsers: AdminUsersRepository,
    private readonly adminSessions: AdminSessionsRepository,
  ) {}

  async login(body: AdminLoginBody, res: Response): Promise<AdminSessionResponse> {
    const admin = await this.adminUsers.findByEmail(body.email);

    // ONE generic error for unknown-email, wrong-password, AND inactive admin
    // — never distinguish which, to avoid user enumeration.
    if (!admin || !admin.isActive || !verifyPassword(body.password, admin.passwordHash)) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'ADMIN_CREDENTIALS_INVALID', 'Invalid email or password');
    }

    const sessionExpiresAt = await this.mintSession(admin.id, res);
    return adminSessionResponseSchema.parse({
      admin: mapAdminUserToDto(admin),
      sessionExpiresAt: sessionExpiresAt.toISOString(),
    });
  }

  async logout(sessionId: string, res: Response): Promise<void> {
    await this.adminSessions.revoke(sessionId);
    res.clearCookie(ADMIN_SESSION_COOKIE, { path: '/' });
  }

  me(adminUser: AdminUser): AdminUserDto {
    return mapAdminUserToDto(adminUser);
  }

  private async mintSession(adminUserId: string, res: Response): Promise<Date> {
    const durationMs = ADMIN_SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + durationMs);
    const session = await this.adminSessions.create(adminUserId, expiresAt);

    res.cookie(ADMIN_SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: !isDevLikeEnv(),
      path: '/',
      maxAge: durationMs,
    });

    return session.expiresAt;
  }
}

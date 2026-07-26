import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminUser } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { AdminSessionsRepository } from './admin-sessions.repository';
import { AdminUsersRepository } from '../admin-users/admin-users.repository';

/** Cookie name carrying the opaque AdminUser session id (ARCHITECTURE §3.3).
 * Entirely separate from `c2g_member_session` — different cookie name,
 * different table, different guard stack, never conflated. */
export const ADMIN_SESSION_COOKIE = 'c2g_admin_session';

export interface AdminAuthContext {
  sessionId: string;
  adminUser: AdminUser;
}

/** Augments Express `Request` with the resolved AdminUser session (set by
 * `AdminSessionGuard`). */
export interface RequestWithAdminAuth extends Request {
  adminAuth?: AdminAuthContext;
}

/**
 * Hard-guards a route behind an active AdminUser session (ARCHITECTURE §3.3).
 * Reads the opaque session id from the `c2g_admin_session` cookie, resolves
 * it via `AdminSessionsRepository.findValid` — which is implicitly
 * tenant-scoped (`withTenant()`/RLS), so a session minted under a different
 * tenant is simply invisible (`null`) here, the correct fail-closed outcome
 * for a cross-tenant cookie replay.
 *
 * Defense-in-depth: even a still-valid session row is rejected if the
 * underlying AdminUser is missing or `!isActive` — a deactivated admin whose
 * session wasn't yet (or somehow failed to be) revoked must still fail
 * closed rather than rely solely on the revocation cascade.
 */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly adminSessions: AdminSessionsRepository,
    private readonly adminUsers: AdminUsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithAdminAuth>();
    const sessionId = req.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
    if (!sessionId) throw ApiError.unauthenticated();

    const session = await this.adminSessions.findValid(sessionId);
    if (!session) throw ApiError.unauthenticated();

    const adminUser = await this.adminUsers.findById(session.adminUserId);
    if (!adminUser || !adminUser.isActive) throw ApiError.unauthenticated();

    await this.adminSessions.touchLastSeen(session.id);
    req.adminAuth = { sessionId: session.id, adminUser };
    return true;
  }
}

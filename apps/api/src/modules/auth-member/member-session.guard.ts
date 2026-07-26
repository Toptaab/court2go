import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../../common/api-error';
import { ClientSessionsRepository } from './client-sessions.repository';

/** Cookie name carrying the opaque Member session id (ARCHITECTURE §3.3). */
export const MEMBER_SESSION_COOKIE = 'c2g_member_session';

export interface MemberAuthContext {
  sessionId: string;
  memberId: string;
}

/** Augments Express `Request` with the resolved Member session (set by
 * `MemberSessionGuard`, or manually via `resolveOptionalMemberId`). */
export interface RequestWithMemberAuth extends Request {
  memberAuth?: MemberAuthContext;
}

/**
 * Hard-guards a route behind an active Member session (ARCHITECTURE §3.3).
 * Reads the opaque session id from the `c2g_member_session` cookie, resolves
 * it via `ClientSessionsRepository.findValid` — which is implicitly
 * tenant-scoped (`withTenant()`/RLS), so a session minted under a different
 * tenant is simply invisible (`null`) here, the correct fail-closed outcome
 * for a cross-tenant cookie replay, not a special case to detect.
 *
 * Routes reachable unauthenticated (OTP request/verify for the LOGIN
 * purpose) must NOT use this guard — see `resolveOptionalMemberId` instead.
 */
@Injectable()
export class MemberSessionGuard implements CanActivate {
  constructor(private readonly clientSessions: ClientSessionsRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithMemberAuth>();
    const sessionId = req.cookies?.[MEMBER_SESSION_COOKIE] as string | undefined;
    if (!sessionId) throw ApiError.unauthenticated();

    const session = await this.clientSessions.findValid(sessionId);
    if (!session) throw ApiError.unauthenticated();

    await this.clientSessions.touchLastSeen(session.id);
    req.memberAuth = { sessionId: session.id, memberId: session.memberId };
    return true;
  }
}

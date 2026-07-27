import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../../common/api-error';
import { tenantContextStorage } from '../../prisma/tenant-context';
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
 *
 * `findValid` is tenant-scoped (`withTenant()`/RLS) and therefore requires
 * `TenantContextMiddleware` to have pinned SOME tenant into `AsyncLocalStorage`
 * first. That's normally true (either the cookie itself resolved a tenant, or
 * an `x-tenant-id` header did) — but an expired/revoked/garbage cookie with no
 * header present resolves to genuinely no context (ARCHITECTURE §2.2: the
 * middleware's job is to pin context when it can, not to authenticate). Such a
 * request can never be legitimately authenticated, so fail closed with 401
 * here, the same as the no-cookie case above, rather than let
 * `getTenantId()` throw a generic 500 further down.
 */
@Injectable()
export class MemberSessionGuard implements CanActivate {
  constructor(private readonly clientSessions: ClientSessionsRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithMemberAuth>();
    const sessionId = req.cookies?.[MEMBER_SESSION_COOKIE] as string | undefined;
    if (!sessionId) throw ApiError.unauthenticated();
    if (!tenantContextStorage.getStore()) throw ApiError.unauthenticated();

    const session = await this.clientSessions.findValid(sessionId);
    if (!session) throw ApiError.unauthenticated();

    await this.clientSessions.touchLastSeen(session.id);
    req.memberAuth = { sessionId: session.id, memberId: session.memberId };
    return true;
  }
}

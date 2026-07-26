import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { MEMBER_SESSION_COOKIE, type MemberAuthContext, type RequestWithMemberAuth } from './member-session.guard';
import type { ClientSessionsRepository } from './client-sessions.repository';

/** Param decorator for routes guarded by `MemberSessionGuard` — returns the
 * `{ sessionId, memberId }` context the guard attached to the request. */
export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MemberAuthContext => {
    const req = ctx.switchToHttp().getRequest<RequestWithMemberAuth>();
    // Only usable behind MemberSessionGuard, which guarantees this is set.
    return req.memberAuth!;
  },
);

/**
 * Resolves an OPTIONAL current Member id from the session cookie, WITHOUT
 * hard-guarding the route. Used by the OTP request/verify endpoints, which
 * must remain reachable unauthenticated for the LOGIN purpose but still need
 * to know "is there already a logged-in member" for the BIND purpose
 * (PRD C2.3) — a missing/invalid/expired cookie simply resolves to `null`
 * rather than a 401, unlike `MemberSessionGuard`.
 */
export async function resolveOptionalMemberId(
  req: Request,
  clientSessions: ClientSessionsRepository,
): Promise<string | null> {
  const sessionId = (req as Request & { cookies?: Record<string, string> }).cookies?.[MEMBER_SESSION_COOKIE];
  if (!sessionId) return null;
  const session = await clientSessions.findValid(sessionId);
  return session ? session.memberId : null;
}

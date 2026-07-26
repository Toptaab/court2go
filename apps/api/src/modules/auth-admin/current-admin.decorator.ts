import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminAuthContext, RequestWithAdminAuth } from './admin-session.guard';

/** Param decorator for routes guarded by `AdminSessionGuard` — returns the
 * `{ sessionId, adminUser }` context the guard attached to the request. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminAuthContext => {
    const req = ctx.switchToHttp().getRequest<RequestWithAdminAuth>();
    // Only usable behind AdminSessionGuard, which guarantees this is set.
    return req.adminAuth!;
  },
);

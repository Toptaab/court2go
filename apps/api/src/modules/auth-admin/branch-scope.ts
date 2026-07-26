import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../../common/api-error';
import type { RequestWithAdminAuth } from './admin-session.guard';

/** Minimal shape `assertBranchScope` needs — accepts a full Prisma
 * `AdminUser` or a plain object, whichever the caller already has on hand. */
export interface BranchScopedAdmin {
  role: 'OWNER' | 'ADMIN' | 'BRANCH_ADMIN';
  branchId: string | null;
}

/**
 * The primary, unit-testable branch-scope primitive (ARCHITECTURE §3.3,
 * ADR-0005). `BRANCH_ADMIN` may only touch resources belonging to their own
 * `branchId`; `OWNER`/`ADMIN` are tenant-wide and always pass. Services that
 * load a resource and already know its `branchId` (e.g. M7's payment
 * confirm/reject, which loads a Booking) call this directly — it is the
 * load-bearing enforcement, independent of any HTTP-layer guard.
 */
export function assertBranchScope(adminUser: BranchScopedAdmin, resourceBranchId: string | null): void {
  if (adminUser.role !== 'BRANCH_ADMIN') return;
  if (resourceBranchId === null || resourceBranchId !== adminUser.branchId) {
    throw ApiError.forbidden('This resource belongs to a different branch', 'BRANCH_SCOPE_DENIED');
  }
}

/* ------------------------------------------------------------- HTTP-layer helper */

export const BRANCH_SCOPE_KEY = 'branchScope';

export interface BranchScopeOptions {
  /** Where to read the branchId from on the request. */
  source: 'query' | 'params';
  /** Property name within that source object. Defaults to `branchId`. */
  key?: string;
}

/**
 * Decorator for the simple case where the target branchId is directly on the
 * request (e.g. `GET /admin/bookings?branchId=`). Pair with
 * `BranchScopeGuard`, which must run after `AdminSessionGuard`.
 */
export const BranchScoped = (options: BranchScopeOptions = { source: 'query' }) => SetMetadata(BRANCH_SCOPE_KEY, options);

/**
 * Reads the configured branchId location, and:
 *  - for OWNER/ADMIN: passes through untouched (tenant-wide).
 *  - for BRANCH_ADMIN with a branchId supplied: enforces it matches their own
 *    branch via `assertBranchScope`.
 *  - for BRANCH_ADMIN with NO branchId supplied: force-narrows the request by
 *    writing their own branchId into the configured location, so downstream
 *    handlers/services see a scoped request without needing to special-case
 *    "no branchId means give me everything" for this role. This is a
 *    convenience default, not the primary guarantee — `assertBranchScope`
 *    (called again here, and independently by services) is what actually
 *    enforces the boundary.
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<BranchScopeOptions | undefined>(BRANCH_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const req = context.switchToHttp().getRequest<RequestWithAdminAuth>();
    const adminUser = req.adminAuth?.adminUser;
    if (!adminUser) throw ApiError.unauthenticated();

    const key = options.key ?? 'branchId';
    const bag = (options.source === 'params' ? req.params : req.query) as Record<string, unknown>;
    const supplied = bag?.[key];
    const resourceBranchId = typeof supplied === 'string' && supplied.length > 0 ? supplied : null;

    if (adminUser.role === 'BRANCH_ADMIN' && resourceBranchId === null) {
      // Force-narrow: no branchId supplied by a BRANCH_ADMIN means "their own branch", not "all branches".
      bag[key] = adminUser.branchId ?? '';
      return true;
    }

    assertBranchScope(adminUser, resourceBranchId);
    return true;
  }
}

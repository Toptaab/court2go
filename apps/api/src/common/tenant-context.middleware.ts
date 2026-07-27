import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantsRepository } from '../modules/tenants/tenants.repository';
import { tenantContextStorage } from '../prisma/tenant-context';
import { ApiError } from './api-error';
import { ADMIN_SESSION_COOKIE } from '../modules/auth-admin/admin-session.guard';
import { MEMBER_SESSION_COOKIE } from '../modules/auth-member/member-session.guard';

/**
 * Resolves the request tenant BEFORE any handler/repository runs and pins it
 * into `AsyncLocalStorage` for the rest of the request (ARCHITECTURE §2.2).
 *
 * Resolution order (session ALWAYS wins over header):
 *   1. `c2g_admin_session` cookie — if present, resolve its tenant via
 *      `resolve_session_tenant('admin', ...)` (a SECURITY DEFINER DB
 *      function; see migration `20260727042112_resolve_session_tenant_fn`).
 *      A live session pins that tenant and short-circuits the rest of this
 *      order — a client-supplied `x-tenant-id` header is ignored entirely
 *      in that case.
 *   2. Else `c2g_member_session` cookie — same resolution via
 *      `resolve_session_tenant('member', ...)`.
 *   3. Else (no session cookie, or the cookie resolved to NULL because the
 *      session is invalid/expired/revoked/garbage) — fall back to the
 *      `x-tenant-id` header = the public URL slug, validated against the
 *      `Tenant` table. Unknown slug → 404 `TENANT_NOT_FOUND`.
 *
 * If nothing resolves the request proceeds WITHOUT context; any handler that
 * touches tenant-owned data then throws via `getTenantId()` (fail closed) —
 * routes that legitimately need no tenant (e.g. `/health`) are simply not
 * covered by this middleware. A present-but-invalid session cookie must NOT
 * hard-fail here — this middleware's job is to pin context when it can, not
 * to authenticate; the session guards are what turn "no context resolved"
 * into the correct 401.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenants: TenantsRepository) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = await this.resolveSessionTenantId(req);
      if (tenantId) {
        return tenantContextStorage.run({ tenantId }, () => next());
      }

      const slug = req.header('x-tenant-id');
      if (!slug) return next();

      const tenant = await this.tenants.findBySlug(slug);
      if (!tenant) {
        return next(ApiError.notFound('Tenant not found', 'TENANT_NOT_FOUND'));
      }
      tenantContextStorage.run({ tenantId: tenant.id }, () => next());
    } catch (err) {
      next(err as Error);
    }
  }

  /** Admin cookie takes precedence over member cookie; either one falls
   * through (not hard-fails) to the caller when it resolves to `null`. */
  private async resolveSessionTenantId(req: Request): Promise<string | null> {
    const adminSessionId = req.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
    if (adminSessionId) {
      const tenantId = await this.tenants.resolveSessionTenant('admin', adminSessionId);
      if (tenantId) return tenantId;
    }

    const memberSessionId = req.cookies?.[MEMBER_SESSION_COOKIE] as string | undefined;
    if (memberSessionId) {
      const tenantId = await this.tenants.resolveSessionTenant('member', memberSessionId);
      if (tenantId) return tenantId;
    }

    return null;
  }
}

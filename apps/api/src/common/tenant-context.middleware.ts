import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantsRepository } from '../modules/tenants/tenants.repository';
import { tenantContextStorage } from '../prisma/tenant-context';
import { ApiError } from './api-error';

/**
 * Resolves the request tenant BEFORE any handler/repository runs and pins it
 * into `AsyncLocalStorage` for the rest of the request (ARCHITECTURE §2.2).
 *
 * Resolution order (later wins):
 *   1. `x-tenant-id` header = the public URL slug, validated against the
 *      `Tenant` table. Unknown slug → 404 `TENANT_NOT_FOUND`.
 *   2. (M5/M8) An authenticated Member/Admin session's `tenantId` — always
 *      overrides any client-supplied header. Wired when auth lands.
 *
 * If neither is present the request proceeds WITHOUT context; any handler that
 * touches tenant-owned data then throws via `getTenantId()` (fail closed) —
 * routes that legitimately need no tenant (e.g. `/health`) are simply not
 * covered by this middleware.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenants: TenantsRepository) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
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
}

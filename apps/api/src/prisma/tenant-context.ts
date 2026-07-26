import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped tenant context (ARCHITECTURE §2.1). NestJS middleware
 * populates this from the resolved tenant BEFORE any repository/service code
 * runs (public routes: `x-tenant-id` validated against the slug; authenticated
 * routes: the Member/AdminUser session's `tenantId`, which always wins over
 * any client-supplied header). `PrismaService` reads it to issue
 * `SET LOCAL app.tenant_id` as the first statement of every transaction —
 * the single place that makes Postgres RLS (the hard tenant-isolation
 * guarantee) actually reachable.
 *
 * This is ergonomics + fail-fast defense-in-depth, NOT the isolation
 * guarantee itself — that's the RLS policies added in the initial migration
 * (see prisma/migrations/*_init/migration.sql §4). If this context is ever
 * missing or wrong, RLS still fails CLOSED (zero rows), never open.
 */
export interface TenantContext {
  tenantId: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/** Throws — by design — if called outside a request that resolved a tenant.
 * Repositories/services must never silently run unscoped. */
export function getTenantId(): string {
  const ctx = tenantContextStorage.getStore();
  if (!ctx) {
    throw new Error(
      'getTenantId() called outside a tenant-scoped request context. ' +
        'This should be impossible if TenantContextMiddleware ran — treat as a bug, not a fallback-to-unscoped case.',
    );
  }
  return ctx.tenantId;
}

export function runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return tenantContextStorage.run({ tenantId }, fn);
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { getTenantId } from './tenant-context';

/** The subset of PrismaClient exposed inside a tenant-scoped transaction —
 * i.e. what a repository method actually gets as `tx`. */
export type TenantPrisma = Prisma.TransactionClient;

/**
 * PrismaService (ARCHITECTURE §2.1, §3.1). Connects as the least-privilege
 * `app_user` Postgres role (APP_DATABASE_URL) at runtime — NEVER the
 * migration/owner role — so Row-Level Security is a real guarantee and not
 * silently bypassed by table ownership. `DATABASE_URL` (the owner role) is
 * used only by `prisma migrate`/`prisma db seed`, never by this service.
 *
 * Every tenant-scoped read/write MUST go through `withTenant()`, which opens
 * a transaction and issues `SELECT set_config('app.tenant_id', $1, true)` —
 * the Postgres equivalent of `SET LOCAL` with safe parameter binding — as the
 * FIRST statement, before any repository query runs inside that same
 * transaction. This is what makes the RLS policies in the initial migration
 * enforceable: the policy reads `current_setting('app.tenant_id', true)`,
 * and that GUC only exists for the lifetime of this one transaction.
 *
 * Repositories never call `this.prisma.<model>` directly for tenant-owned
 * data — they receive a `TenantPrisma` (`tx`) handle from `withTenant()`.
 * A handful of legitimately tenant-agnostic queries (resolving a Tenant by
 * slug, the one public bootstrap call) use `raw()` instead, deliberately
 * bypassing tenant scoping — call sites for those are rare and reviewed.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL,
      // Prisma v7 requires a driver adapter (the Rust query engine is gone)
      // and adapters inherit the underlying driver's own pool defaults —
      // `pg`'s `connectionTimeoutMillis` defaults to `0` (no timeout), unlike
      // Prisma v6's Rust engine, which defaulted to 5s. Set it explicitly so
      // we don't silently lose that timeout on the v7 upgrade.
      connectionTimeoutMillis: 5000,
    });
    this.client = new PrismaClient({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  /** Escape hatch for genuinely tenant-agnostic queries (e.g. `Tenant` table
   * itself, which carries no RLS policy). Do not use this for any
   * tenant-owned model — it will return zero rows under RLS anyway (fail
   * closed), which is the correct outcome for a missing/forgotten scope. */
  raw(): PrismaClient {
    return this.client;
  }

  /**
   * Run `fn` inside a transaction with `app.tenant_id` set to the ambient
   * request tenant (from `AsyncLocalStorage`, populated by
   * `TenantContextMiddleware`). Every repository method that touches a
   * tenant-owned table should be written in terms of this, e.g.:
   *
   *   return this.prisma.withTenant((tx) => tx.booking.findMany({ ... }));
   *
   * `tenantId` is read fresh per call (never cached) so a repository never
   * accidentally reuses a stale tenant across requests.
   */
  withTenant<T>(fn: (tx: TenantPrisma) => Promise<T>): Promise<T> {
    const tenantId = getTenantId();
    return this.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }

  /**
   * Same as `withTenant`, but for an explicitly-supplied tenant id rather
   * than the ambient request context — used by the background hold-expiry
   * sweeper (ARCHITECTURE §5.3), which iterates tenants outside any HTTP
   * request and therefore has no `AsyncLocalStorage` context to read from.
   */
  withExplicitTenant<T>(tenantId: string, fn: (tx: TenantPrisma) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}

# ADR-0002: Multi-tenancy — shared database/schema, tenantId + Postgres RLS

## Status
Accepted

## Context
Multi-tenancy is a hard, resolved MVP requirement (HANDOFF #2, PRD NFR4): every tenant-owned entity is scoped to exactly one Tenant, isolation must hold "even on shared infrastructure," and cross-tenant leakage is explicitly a critical-severity defect. Tenants are provisioned manually by internal ops (no self-serve signup); MVP tenant count is small. The same phone number must produce **independent** Member records per tenant.

### Options considered
1. **Database-per-tenant.** Strongest physical isolation; heaviest operational cost (migrations × N databases, connection pooling complexity, cross-tenant reporting becomes a fan-out). Overkill for internal-ops-provisioned, small-N MVP tenants.
2. **Schema-per-tenant** (one Postgres schema per tenant, same database). Better than #1 operationally, still requires dynamic schema-qualified connections/migrations per tenant and doesn't meaningfully outperform RLS for the isolation guarantee it buys.
3. **Shared database, shared schema, `tenantId` discriminator column, enforced only in application code** (the common "just remember the `where` clause" approach). Simplest to build, but a single missed `where: { tenantId }` is a silent cross-tenant data leak — unacceptable given the PRD's explicit "critical severity" framing.
4. **Shared database, shared schema, `tenantId` discriminator + Postgres Row-Level Security as the enforced guarantee, with an ORM-level layer for ergonomics/defense-in-depth.**

## Decision
Option 4. Every tenant-owned table carries a `tenant_id` column, `ENABLE ROW LEVEL SECURITY`, and a policy `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. The Postgres role Prisma connects as is a **non-superuser, non-table-owner** application role (RLS is bypassed by table owners/superusers by default in Postgres, so this is load-bearing, not incidental). Every request transaction issues `SET LOCAL app.tenant_id = '<uuid>'` before any query. A Prisma Client Extension is the second, cooperating layer: it reads tenant from a request-scoped `AsyncLocalStorage` context, throws if absent (fail closed, never fail open to "unscoped"), auto-injects `tenantId` into queries for ergonomics, and is where the `SET LOCAL` is issued inside the same transaction as the query.

`Member` uniqueness is `(tenantId, phone)`, not global `phone` — this is what makes "same phone = independent Member per tenant" fall out of the model automatically rather than needing special-case logic anywhere.

## Consequences
- Two independent layers mean a bug in either (a missed extension wrapper on some future raw query, or a misconfigured policy) doesn't singlehandedly cause a leak — the other still holds. This is the direct answer to NFR4's "must hold even on shared infrastructure" and "critical severity" framing.
- All tenant-owned tables need the RLS policy set up in a raw-SQL migration step (Prisma has no declarative RLS primitive) — flagged for `prisma-data` in ARCHITECTURE.md §9.
- Every DB connection pool must be tenant-context-aware per transaction (`SET LOCAL`, not `SET`, so it never leaks across pooled connections) — this is a hard requirement on how `PrismaService` opens transactions, documented so it isn't accidentally "optimized away."
- Reporting/analytics that legitimately need cross-tenant aggregation (internal ops, platform health per PRD persona 3.4) must go through an explicit superuser/ops path that bypasses RLS deliberately and audibly — not a route reachable by tenant-facing code.
- If a tenant later needs physical isolation (e.g. a large enterprise customer with a data-residency requirement), that tenant can be migrated out to its own database without changing the application model — the `tenantId` discriminator design doesn't foreclose that path, it just isn't needed for MVP.

import { Injectable } from '@nestjs/common';
import { Tenant } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * TenantsRepository — the one repository that deliberately does NOT go
 * through `PrismaService.withTenant()`, because `Tenant` is the scoping
 * root, not a tenant-owned table (no RLS policy applies to it — see
 * schema.prisma's model doc comment). Used by `TenantContextMiddleware`
 * (ARCHITECTURE §2.2) to resolve `x-tenant-id` from a public URL slug
 * BEFORE any tenant context exists to set.
 */
@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.raw().tenant.findUnique({ where: { slug } });
  }

  findById(id: string): Promise<Tenant | null> {
    return this.prisma.raw().tenant.findUnique({ where: { id } });
  }

  /** Internal-ops provisioning only (PRD 3.4) — never exposed to a
   * self-service endpoint. Caller is responsible for also creating the
   * Owner AdminUser and default Config in the same operational flow (see
   * `apps/api/prisma/seed.ts` for the reference sequence). */
  create(data: { slug: string; name: string }): Promise<Tenant> {
    return this.prisma.raw().tenant.create({ data });
  }

  updateBranding(
    id: string,
    branding: { logoUrl?: string | null; primaryColor?: string | null; secondaryColor?: string | null },
  ): Promise<Tenant> {
    return this.prisma.raw().tenant.update({ where: { id }, data: branding });
  }

  /**
   * Resolves the `tenantId` pinned to a live Member/Admin session, calling
   * the `resolve_session_tenant` SECURITY DEFINER function (see migration
   * `20260727042112_resolve_session_tenant_fn`). Used by
   * `TenantContextMiddleware` (ARCHITECTURE §2.2) to derive tenant context
   * from an authenticated session cookie BEFORE any RLS-scoped query can
   * run — the same chicken-and-egg reason `findBySlug` above bypasses
   * `withTenant()`.
   *
   * Returns `null` for any invalid/expired/revoked/garbage session id
   * (the function itself fails closed) — callers must treat that as "no
   * session tenant resolved", not an error.
   */
  async resolveSessionTenant(kind: 'member' | 'admin', sessionId: string): Promise<string | null> {
    const rows = await this.prisma.raw().$queryRaw<
      { resolve_session_tenant: string | null }[]
    >`SELECT resolve_session_tenant(${kind}, ${sessionId})`;
    return rows[0]?.resolve_session_tenant ?? null;
  }
}

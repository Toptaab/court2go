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
}

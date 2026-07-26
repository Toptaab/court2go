import { Injectable } from '@nestjs/common';
import { Config, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/** Config (PRD Domain Glossary, A8.1) — 1:1 with the ambient Tenant. */
@Injectable()
export class ConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  get(): Promise<Config | null> {
    return this.prisma.withTenant((tx) => tx.config.findUnique({ where: { tenantId: getTenantId() } }));
  }

  /** Full-replace (PUT semantics, PRD A8.1) — mirrors `updateConfigBodySchema`. */
  update(data: Omit<Prisma.ConfigUncheckedCreateInput, 'id' | 'tenantId'>): Promise<Config> {
    const tenantId = getTenantId();
    return this.prisma.withTenant((tx) =>
      tx.config.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      }),
    );
  }
}

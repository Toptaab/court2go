import { Injectable } from '@nestjs/common';
import { ActorType, AuditLog, Prisma } from '../../generated/prisma/client';
import { PrismaService, TenantPrisma } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

export interface AuditEntry {
  actorType: ActorType;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Generic audit trail (ARCHITECTURE §3.4, NFR8). Every booking status
 * change, payment confirm/reject, and admin CRUD action should write one row
 * here — from the SAME service method that performs the transition, so the
 * two writes are naturally in the same `withTenant` transaction (call
 * `record()` for a standalone write, or `recordWithTx()` for a call site
 * that's already inside another repository's `withTenant` callback and
 * wants the audit row in the SAME transaction).
 */
@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry): Promise<AuditLog> {
    return this.prisma.withTenant((tx) => tx.auditLog.create({ data: { tenantId: getTenantId(), ...entry } }));
  }

  recordWithTx(tx: TenantPrisma, entry: AuditEntry): Promise<AuditLog> {
    return tx.auditLog.create({ data: { tenantId: getTenantId(), ...entry } });
  }

  listForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.prisma.withTenant((tx) =>
      tx.auditLog.findMany({ where: { entityType, entityId }, orderBy: { createdAt: 'desc' } }),
    );
  }
}

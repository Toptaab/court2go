import { Injectable } from '@nestjs/common';
import { ClientSession } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/**
 * ClientSession (ARCHITECTURE §3.3) — DB-backed Member session, opaque
 * cookie `c2g_member_session`. Revocation (block, logout-everywhere) is a
 * plain `UPDATE ... SET revoked_at = now()`, not a token blacklist.
 */
@Injectable()
export class ClientSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(memberId: string, expiresAt: Date): Promise<ClientSession> {
    return this.prisma.withTenant((tx) =>
      tx.clientSession.create({ data: { tenantId: getTenantId(), memberId, expiresAt } }),
    );
  }

  /** Also verifies `expiresAt > now()` and `revokedAt IS NULL` — a caller
   * should treat `null` as "not authenticated", not distinguish why. */
  findValid(id: string): Promise<ClientSession | null> {
    return this.prisma.withTenant((tx) =>
      tx.clientSession.findFirst({
        where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    );
  }

  touchLastSeen(id: string): Promise<ClientSession> {
    return this.prisma.withTenant((tx) =>
      tx.clientSession.update({ where: { id }, data: { lastSeenAt: new Date() } }),
    );
  }

  revoke(id: string): Promise<ClientSession> {
    return this.prisma.withTenant((tx) =>
      tx.clientSession.update({ where: { id }, data: { revokedAt: new Date() } }),
    );
  }

  /** PRD A7.1 AC3 — blocking a Member must end all of their active sessions immediately. */
  revokeAllForMember(memberId: string): Promise<{ count: number }> {
    return this.prisma.withTenant((tx) =>
      tx.clientSession.updateMany({ where: { memberId, revokedAt: null }, data: { revokedAt: new Date() } }),
    );
  }
}

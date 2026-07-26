import { Injectable } from '@nestjs/common';
import { AdminSession } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/** AdminSession (ARCHITECTURE §3.3) — cookie `c2g_admin_session`, entirely
 * separate table/mechanism from ClientSession so the two principal types can
 * never be confused by a shared-domain admin/public route collision. */
@Injectable()
export class AdminSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(adminUserId: string, expiresAt: Date): Promise<AdminSession> {
    return this.prisma.withTenant((tx) =>
      tx.adminSession.create({ data: { tenantId: getTenantId(), adminUserId, expiresAt } }),
    );
  }

  findValid(id: string): Promise<AdminSession | null> {
    return this.prisma.withTenant((tx) =>
      tx.adminSession.findFirst({ where: { id, revokedAt: null, expiresAt: { gt: new Date() } } }),
    );
  }

  touchLastSeen(id: string): Promise<AdminSession> {
    return this.prisma.withTenant((tx) =>
      tx.adminSession.update({ where: { id }, data: { lastSeenAt: new Date() } }),
    );
  }

  revoke(id: string): Promise<AdminSession> {
    return this.prisma.withTenant((tx) => tx.adminSession.update({ where: { id }, data: { revokedAt: new Date() } }));
  }

  /** Removing/deactivating an AdminUser cascades to instant revocation of all
   * their sessions (ARCHITECTURE §3.3) — called by `AdminUsersService`. */
  revokeAllForAdminUser(adminUserId: string): Promise<{ count: number }> {
    return this.prisma.withTenant((tx) =>
      tx.adminSession.updateMany({ where: { adminUserId, revokedAt: null }, data: { revokedAt: new Date() } }),
    );
  }
}

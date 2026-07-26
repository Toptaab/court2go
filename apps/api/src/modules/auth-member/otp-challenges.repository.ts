import { Injectable } from '@nestjs/common';
import { OtpChallenge, OtpPurpose } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/**
 * OtpChallenge (ARCHITECTURE §4.1). Codes are NEVER stored in plaintext —
 * only `codeHash` (caller hashes via the same scheme regardless of
 * `OtpSender` adapter). SMS is the sole channel end-to-end; this repository
 * has no notion of LINE at all — that boundary is enforced by there being no
 * LINE-backed `OtpSender` implementation, not by anything here.
 */
@Injectable()
export class OtpChallengesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    phone: string;
    purpose: OtpPurpose;
    memberId?: string | null;
    codeHash: string;
    expiresAt: Date;
  }): Promise<OtpChallenge> {
    return this.prisma.withTenant((tx) =>
      tx.otpChallenge.create({ data: { tenantId: getTenantId(), ...data } }),
    );
  }

  findById(id: string): Promise<OtpChallenge | null> {
    return this.prisma.withTenant((tx) => tx.otpChallenge.findUnique({ where: { id } }));
  }

  incrementAttempts(id: string): Promise<OtpChallenge> {
    return this.prisma.withTenant((tx) =>
      tx.otpChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } }),
    );
  }

  consume(id: string): Promise<OtpChallenge> {
    return this.prisma.withTenant((tx) => tx.otpChallenge.update({ where: { id }, data: { consumedAt: new Date() } }));
  }

  /** Rate limiting (PRD C2.5 AC3/AC5): count of challenges sent to this
   * phone within the rolling window, for the resend-cooldown + max-sends-
   * per-hour checks (`Config.otpResendCooldownSeconds`/`otpMaxSendsPerHour`). */
  countRecentForPhone(phone: string, since: Date): Promise<number> {
    return this.prisma.withTenant((tx) =>
      tx.otpChallenge.count({ where: { phone, createdAt: { gte: since } } }),
    );
  }

  mostRecentForPhone(phone: string): Promise<OtpChallenge | null> {
    return this.prisma.withTenant((tx) =>
      tx.otpChallenge.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } }),
    );
  }
}

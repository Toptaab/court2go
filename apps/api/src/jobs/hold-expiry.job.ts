import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsRepository } from '../modules/bookings/bookings.repository';

/**
 * Fixed, arbitrary bigint-safe key for the `pg_try_advisory_lock` singleton-
 * worker guard (ARCHITECTURE §5.3 layer 2). Unrelated to, and not a
 * substitute for, the double-booking guarantee in ADR-0003 — this lock ONLY
 * prevents two horizontally-scaled API instances from running the sweep at
 * the same instant; correctness holds even if this lock were removed
 * entirely (the sweep queries are idempotent `updateMany`s).
 */
const ADVISORY_LOCK_KEY = 847_362_915;

/**
 * Background hold-expiry sweeper (ARCHITECTURE §5.3 layer 2) — runs every
 * ~15s, independent of contention on any specific court, so a stale Hold is
 * eventually released even if nobody else tries to book that exact slot
 * again (the "unpaid/expired holds not released automatically: should
 * always be 0" success metric).
 *
 * `pg_try_advisory_lock`/`pg_advisory_unlock` are SESSION-scoped in Postgres
 * — the acquire and release MUST run on the same physical connection, so
 * both live inside one Prisma interactive `$transaction` (which pins one
 * connection for its lifetime), even though the actual sweep work
 * (`sweepAllExpiredHoldsAcrossTenants`) opens its own separate
 * per-tenant transactions via `withExplicitTenant`.
 *
 * Because the sweep is awaited INSIDE that outer transaction, its whole
 * duration counts against Prisma's interactive-transaction budget. We raise
 * that budget well above the ~5s default so a sweep over many tenants can't
 * abort mid-flight — an abort would roll the outer tx back and leave the
 * `finally` unlock running against a dead connection, leaking the advisory
 * lock onto a pooled connection until it's reset.
 */
const TX_OPTIONS = { timeout: 120_000, maxWait: 10_000 } as const;
@Injectable()
export class HoldExpiryJob {
  private readonly logger = new Logger(HoldExpiryJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsRepository,
  ) {}

  @Cron('*/15 * * * * *')
  async sweep(): Promise<void> {
    const client = this.prisma.raw();
    let sweptCount = 0;

    const acquired = await client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`;
      if (!rows[0]?.locked) return false;

      try {
        sweptCount = await this.bookings.sweepAllExpiredHoldsAcrossTenants();
      } finally {
        await tx.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
      }
      return true;
    }, TX_OPTIONS);

    if (acquired && sweptCount > 0) {
      this.logger.log(`Swept ${sweptCount} expired hold(s) across tenants`);
    }
  }
}

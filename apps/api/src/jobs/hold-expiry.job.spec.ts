import type { PrismaService } from '../prisma/prisma.service';
import type { BookingsRepository } from '../modules/bookings/bookings.repository';
import { HoldExpiryJob } from './hold-expiry.job';

/**
 * Unit coverage for the background hold-expiry sweeper (ARCHITECTURE §5.3
 * layer 2) — the `pg_try_advisory_lock` singleton-worker guard is the
 * interesting seam: the sweep must only run when the lock is acquired, and
 * the unlock must ALWAYS fire (even if the sweep itself throws) since the
 * advisory lock is session-scoped and would otherwise leak for the lifetime
 * of the pooled connection.
 */
function build(locked: boolean) {
  const queryRawCalls: unknown[] = [];
  const queryRaw = jest.fn((strings: TemplateStringsArray, ..._args: unknown[]) => {
    const sql = strings.join('?');
    queryRawCalls.push(sql);
    if (sql.includes('pg_try_advisory_lock')) {
      return Promise.resolve([{ locked }]);
    }
    return Promise.resolve([]);
  });
  const tx = { $queryRaw: queryRaw };

  const client = {
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<boolean>) => fn(tx)),
  };

  const prisma = {
    raw: jest.fn().mockReturnValue(client),
  } as unknown as jest.Mocked<PrismaService>;

  const bookings = {
    sweepAllExpiredHoldsAcrossTenants: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<BookingsRepository>;

  const job = new HoldExpiryJob(prisma, bookings);
  return { job, prisma, bookings, tx, client };
}

describe('HoldExpiryJob.sweep', () => {
  it('acquires the advisory lock, runs the sweep, and always unlocks in finally', async () => {
    const { job, bookings, tx } = build(true);
    bookings.sweepAllExpiredHoldsAcrossTenants.mockResolvedValue(3);

    await job.sweep();

    expect(bookings.sweepAllExpiredHoldsAcrossTenants).toHaveBeenCalledTimes(1);
    const calls = (tx.$queryRaw as jest.Mock).mock.calls;
    expect(calls.some((c) => c[0].join('').includes('pg_try_advisory_lock'))).toBe(true);
    expect(calls.some((c) => c[0].join('').includes('pg_advisory_unlock'))).toBe(true);
  });

  it('still calls pg_advisory_unlock when the sweep itself throws', async () => {
    const { job, bookings, tx } = build(true);
    const boom = new Error('sweep failed');
    bookings.sweepAllExpiredHoldsAcrossTenants.mockRejectedValue(boom);

    await expect(job.sweep()).rejects.toThrow(boom);

    const calls = (tx.$queryRaw as jest.Mock).mock.calls;
    expect(calls.some((c) => c[0].join('').includes('pg_advisory_unlock'))).toBe(true);
  });

  it('skips the sweep entirely when the advisory lock is not acquired', async () => {
    const { job, bookings, tx } = build(false);

    await job.sweep();

    expect(bookings.sweepAllExpiredHoldsAcrossTenants).not.toHaveBeenCalled();
    const calls = (tx.$queryRaw as jest.Mock).mock.calls;
    expect(calls.some((c) => c[0].join('').includes('pg_advisory_unlock'))).toBe(false);
  });
});

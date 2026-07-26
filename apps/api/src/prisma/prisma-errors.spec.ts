import { Prisma } from '../generated/prisma/client';
import { isUniqueConstraintViolation } from './prisma-errors';

/**
 * Regression guard for the Prisma v7 driver-adapter (@prisma/adapter-pg) P2002
 * `meta` shape. The double-booking guarantee (ADR-0003) depends on this
 * classifier recognising the `(court_id, slot_start)` unique violation raised
 * by the raw partial index `uniq_active_court_slot` and mapping it to a 409
 * SLOT_UNAVAILABLE. The v6 binary engine exposed the columns at `meta.target`;
 * v7's driver adapter sets `meta.target = undefined` and nests them under
 * `meta.driverAdapterError.cause.constraint.fields` — a shape captured live in
 * the migration review. If a future Prisma/adapter bump moves them again, this
 * spec fails loudly instead of silently downgrading 409s to 500s.
 */
const P2002 = (meta: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('unique constraint', {
    code: 'P2002',
    clientVersion: '7.9.0',
    meta,
  });

describe('isUniqueConstraintViolation', () => {
  // The exact meta observed from @prisma/adapter-pg for the slot collision.
  const adapterSlotMeta = {
    modelName: 'BookingSlot',
    driverAdapterError: {
      cause: {
        originalCode: '23505',
        kind: 'UniqueConstraintViolation',
        constraint: { fields: ['court_id', 'slot_start'] },
      },
    },
  };

  it('matches the slot columns under the v7 driver-adapter meta shape', () => {
    expect(isUniqueConstraintViolation(P2002(adapterSlotMeta), ['court_id', 'slot_start'])).toBe(
      true,
    );
  });

  it('does not misclassify an unrelated unique violation as a slot conflict', () => {
    const memberPhoneMeta = {
      driverAdapterError: { cause: { constraint: { fields: ['tenant_id', 'phone'] } } },
    };
    expect(isUniqueConstraintViolation(P2002(memberPhoneMeta), ['court_id', 'slot_start'])).toBe(
      false,
    );
  });

  it('still matches the legacy binary-engine meta.target (string[]) shape', () => {
    const legacyMeta = { target: ['court_id', 'slot_start'] };
    expect(isUniqueConstraintViolation(P2002(legacyMeta), ['court_id', 'slot_start'])).toBe(true);
  });

  it('returns true for any P2002 when no target columns are required', () => {
    expect(isUniqueConstraintViolation(P2002(adapterSlotMeta))).toBe(true);
  });

  it('fails closed when the columns cannot be recovered from meta', () => {
    // e.g. adapter reports only the index name, not the column list.
    const nameOnlyMeta = { driverAdapterError: { cause: { constraint: { name: 'uniq_x' } } } };
    expect(isUniqueConstraintViolation(P2002(nameOnlyMeta), ['court_id', 'slot_start'])).toBe(
      false,
    );
  });

  it('returns false for a non-P2002 known request error', () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: '7.9.0',
      meta: {},
    });
    expect(isUniqueConstraintViolation(p2025, ['court_id', 'slot_start'])).toBe(false);
  });

  it('returns false for a plain Error', () => {
    expect(isUniqueConstraintViolation(new Error('boom'), ['court_id', 'slot_start'])).toBe(false);
  });
});

import { Prisma } from '../generated/prisma/client';

/**
 * Extract the column names named by a P2002 unique-constraint violation,
 * across the two shapes Prisma uses depending on the query engine:
 *
 *   - Legacy binary engine (Prisma v6 / `prisma-client-js`): `meta.target` —
 *     a `string[]` of column names (or, for some raw indexes, the index-name
 *     string, which yields no usable columns).
 *   - Driver adapter (Prisma v7 / `@prisma/adapter-pg`, this project): the
 *     binary engine is gone; `meta.target` is `undefined` and the violated
 *     columns live at
 *     `meta.driverAdapterError.cause.constraint.fields` (verified empirically
 *     against the raw partial index `uniq_active_court_slot` — the P2002 meta
 *     is `{ modelName, driverAdapterError: { cause: { originalCode: '23505',
 *     kind: 'UniqueConstraintViolation', constraint: { fields: ['court_id',
 *     'slot_start'] } } } }`).
 *
 * Reading BOTH locations keeps the double-booking classifier (below) correct
 * across an engine/adapter swap instead of silently failing closed on one.
 */
function violatedColumns(meta: unknown): Set<string> {
  const columns = new Set<string>();
  const add = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const c of value) if (typeof c === 'string') columns.add(c);
    }
  };

  const m = (meta ?? {}) as {
    target?: unknown;
    driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
  };
  add(m.target);
  add(m.driverAdapterError?.cause?.constraint?.fields);
  return columns;
}

/** True for Prisma's mapping of a Postgres 23505 unique_violation (P2002),
 * regardless of whether the violated constraint is declared in schema.prisma
 * or added via raw SQL (Prisma maps by SQLSTATE, not by recognizing the
 * constraint name). `targetColumns`, if provided, additionally requires the
 * violation to name exactly those columns (e.g. `['court_id', 'slot_start']`
 * for the ADR-0003 guarantee) so we don't misclassify an unrelated unique
 * violation (e.g. `(tenantId, phone)` on Member) as a slot conflict.
 */
export function isUniqueConstraintViolation(err: unknown, targetColumns?: string[]): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
    return false;
  }
  if (!targetColumns) return true;
  const columns = violatedColumns(err.meta);
  return targetColumns.every((c) => columns.has(c));
}

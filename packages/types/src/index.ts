/**
 * @repo/types — the court2go API contract.
 *
 * Single source of truth: zod schemas (runtime validation) + inferred TS types.
 * Both apps bind to this; prisma-data models its enums/entities against it.
 *  - apps/api validates every request body/query with these schemas (NestJS pipe)
 *    and maps Prisma rows → these DTOs before responding.
 *  - apps/web validates forms via zodResolver with the SAME schemas and parses every
 *    response through the matching schema (fail loud on contract drift, ARCHITECTURE §3.2).
 *
 * Layering:
 *   common/   scalar primitives, error envelope, pagination
 *   enums/    frozen vocabularies (status machines, roles, methods)
 *   entities/ persisted resource shapes (+ their public projections)
 *   dto/      request/response shapes per endpoint surface
 */
export * from './version';
export * from './common/index';
export * from './enums/index';
export * from './entities/index';
export * from './dto/index';

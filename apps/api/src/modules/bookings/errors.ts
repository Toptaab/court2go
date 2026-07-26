/**
 * Thrown when a `booking_slot` insert collides with an already-active
 * occupant of a `(court_id, slot_start)` lattice unit (ADR-0003) — Postgres
 * error 23505 on `uniq_active_court_slot`, surfaced by Prisma as
 * `PrismaClientKnownRequestError` code `P2002`. The owning NestJS service
 * catches this and maps it to `409 SLOT_UNAVAILABLE` (ARCHITECTURE §3.4) —
 * repositories never produce HTTP status codes themselves.
 */
export class SlotUnavailableError extends Error {
  constructor(
    public readonly courtId: string,
    public readonly conflictingStart?: Date,
  ) {
    super(`court ${courtId} has no availability for the requested span (concurrent hold)`);
    this.name = 'SlotUnavailableError';
  }
}

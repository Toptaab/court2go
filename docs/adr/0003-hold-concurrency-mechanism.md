# ADR-0003: Hold/concurrency mechanism — Postgres partial unique index

## Status
Accepted

## Context
PRD Goal 3, NFR1, and the "double-booking incidents: 0" success metric require that two clients can never successfully reserve overlapping grid units on the same court, across the entire Hold → OTP-verification → slip-upload → Pending-Payment-Confirmation lifecycle, under real concurrent access — including Admin walk-in creation racing a client's self-service attempt. The Hold window itself is Tenant-configurable (5 or 10 minutes). HANDOFF explicitly calls this the decision the architect must resolve concretely (unique constraint / row lock / advisory lock / etc.).

### Options considered

1. **Application-level check-then-write** ("query availability, then insert if free"). Rejected outright — classic TOCTOU race; two concurrent requests can both pass the availability check before either writes.
2. **Postgres advisory locks** (`pg_advisory_xact_lock`, keyed by court+time). Serializes concurrent *attempts* on the same key for the duration of a transaction, but (a) doesn't itself express a persisted "this slot is occupied until it's released" fact — you still need a table to check availability against once the lock is released, so the lock only prevents a narrow race window, not the durable state; (b) a multi-grid-unit booking (slot count > 1) needs N locks taken in a deterministic order to avoid deadlocking against another multi-unit attempt overlapping only partially — extra complexity for no extra safety over a single atomic insert.
3. **Pre-materialized `grid_unit` table + `SELECT ... FOR UPDATE`.** Requires generating a row per grid unit per court (at each court's grid interval), indefinitely into the future, purely so there's something to lock — a real maintenance burden (schedule/grid-interval changes mean regenerating rows) for a system where most of that grid will never be booked.
4. **External distributed lock (Redis).** Adds an infrastructure dependency and a second source of truth that can desync from the actual booking data in Postgres, to buy a guarantee Postgres can give natively.
5. **A `booking_slot` table (one row per grid unit actually consumed by a booking attempt) with a Postgres partial unique index `UNIQUE (court_id, slot_start) WHERE released_at IS NULL`.**

## Decision
Option 5. `booking_slot` rows are created lazily — only when a booking attempt actually reserves units — inside the same transaction as the `Booking` row's creation. The partial unique index is the enforcement mechanism: a second, concurrent attempt to occupy any of the same `(court_id, slot_start)` pairs raises `23505 unique_violation`, and the entire transaction (Booking + all its BookingSlot rows) rolls back atomically — a multi-unit booking reserves all its units or none. Every release path (Hold expiry, Admin reject, cancellation) is a transaction that sets `released_at = now()` on the relevant rows, which frees the index slot for reuse by a future booking. Availability is computed on read by diffing the theoretical grid (from Court schedule) against active (`released_at IS NULL`) `booking_slot` rows — never pre-materialized.

Uniqueness enforcement doesn't require elevated (`SERIALIZABLE`) isolation — Postgres enforces unique constraints at the default `READ COMMITTED` level regardless — so there's no retry/abort performance tax.

Expiry uses two cooperating layers: (a) a lazy, self-healing sweep of stale holds for the specific court, run as the first step of every new hold attempt on that court (closes the gap between "logically expired" and "background sweeper hasn't run yet" exactly where it matters — at the point of contention); (b) a background cron sweep across all tenants/courts every 15s, guarded by `pg_try_advisory_lock` so only one API instance runs it if horizontally scaled. Note this is the one place advisory locks *are* used in this design — as a singleton-worker convenience, not as the double-booking guarantee itself, which is entirely index-driven and holds regardless of how many API instances are running.

## Consequences
- The correctness guarantee lives in the database, not in application code discipline — safe under horizontal API scaling, safe under process crashes mid-transaction (Postgres rolls back), and identical for client self-service and Admin-created bookings (one code path, no special-casing).
- `prisma-data` must add the partial unique index via raw SQL (not expressible in `schema.prisma`'s `@@unique`) — flagged in ARCHITECTURE.md §9.
- Every state transition that should free a slot (expire, reject, cancel) must remember to update `released_at` — this is centralized in `BookingService`'s transition methods rather than scattered, so it's a single-file review surface, not a "did every code path remember" audit problem.
- The 15-second background sweep interval is a tunable; it does not affect correctness (correctness is index-driven and self-healing at contention time per above) — only how promptly an *uncontended* expired hold's grid units visibly return to "Available" in the UI for someone browsing without yet attempting to book them.

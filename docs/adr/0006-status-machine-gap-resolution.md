# ADR-0006: Booking status-machine gap resolution — Expired applies to both branch payment methods

## Status
Accepted

## Context
HANDOFF open decision #3 asked the architect to confirm the Booking/Payment status sets from PRD §4 are internally consistent and complete before they drive backend logic. Working through the full state machine (ARCHITECTURE.md §6) surfaced one genuine inconsistency:

The PRD Domain Glossary annotates `Expired` as **"(Hold expired with no slip uploaded — QR Code Branches only)"**. Taken literally, a Pay-Onsite booking could never reach `Expired`. But PRD NFR2 is explicit that a Pay-Onsite booking's Hold still has to cover "slot selection through phone verification" — and nothing guarantees a client completes that verification. If a Pay-Onsite client abandons mid-OTP (closes the tab, never returns), and `Expired` is unreachable for that branch type, the booking is stuck in `PENDING_VERIFICATION` forever: an orphaned Hold, with its `booking_slot` rows never released, permanently blocking that court/time for everyone else.

This directly conflicts with:
- The success metric "unpaid/expired holds not released automatically: should always be 0" — not itself scoped to QR-only.
- NFR1's blanket double-booking-prevention guarantee across "the Hold, OTP/session, ... stages," which doesn't exempt Pay-Onsite.

## Decision
`EXPIRED` is a reachable Booking status from `PENDING_VERIFICATION` for **both** branch payment methods, not QR-Code-only. The PRD glossary's "(QR Code Branches only)" annotation is interpreted as describing the *typical* trigger for reaching `Expired` (slip-upload timeout being the more common real-world case, since most Hold time is spent there) rather than a hard restriction on which branch types can produce that status. Concretely: any booking whose Hold window elapses before its **required precondition for that branch type** is met — verification, for both branch types; verification *and* slip upload, for QR-Code — transitions to `EXPIRED` and releases its grid units via the same mechanism (ADR-0003).

This resolution changes no explicitly-specified PRD behavior — every acceptance criterion that mentions `Expired` for a QR-Code Branch is preserved exactly as written — it only fills an edge case (Pay-Onsite + abandoned verification) the PRD's acceptance criteria don't walk through, and it does so by extending an existing status to a case it logically already needed to cover, rather than inventing a new one.

## Consequences
- No new status value, no schema impact beyond what QR-Code already required — `EXPIRED` was already a first-class Booking status.
- The Hold-expiry sweep (ADR-0003 §5.3) needs no branch-type special-casing: it sweeps any `PENDING_VERIFICATION` or `PENDING_PAYMENT` booking past `expiresAt`, regardless of the owning Branch's payment method — one code path, matching the "one mechanism for both branch types" principle used throughout the concurrency design.
- This is noted here for traceability precisely because it's an architect-filled gap rather than an explicit PRD statement; if a future product review disagrees (e.g., wants Pay-Onsite abandoned-verification bookings surfaced differently from QR-Code expiries), it's a one-line status-mapping change isolated to `BookingService`'s expiry-transition method, not a data-model change.

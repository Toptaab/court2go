-- ============================================================================
-- RAW SQL ADDITION (owned by prisma-data, hand-written — see the `init`
-- migration's "RAW SQL ADDITIONS" header for the full rationale of why this
-- cannot be expressed in schema.prisma's declarative DSL: Prisma has no CHECK
-- constraint primitive as of this schema's generator version).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CourtScheduleDay: 30-minute lock-lattice alignment (M4 groundwork,
-- ARCHITECTURE §5.1/§5.4). `booking_slot.slot_start` sits on the fixed
-- platform-wide :00/:30 lattice; a Court's openTime/closeTime off that
-- lattice (e.g. "08:15") would push every availability-grid slot generated
-- from it off-lattice too, defeating the `uniq_active_court_slot` partial
-- unique index's double-booking guarantee (two overlapping, differently
-- -phased grids could both believe a half-open interval is free). Defense in
-- depth alongside the app-level zod validation in packages/types: minute
-- component must be "00" or "30" when the column is non-NULL. Both columns
-- are VarChar(5) "HH:MM" (or "24:00" for close_time, per the existing
-- `court_schedule_day_times_check`), so a suffix regex on the last 3 chars is
-- sufficient — "24:00" ends in ":00" and is therefore still permitted as a
-- close_time value.
--
-- This is additive to, not a replacement for, `court_schedule_day_times_check`
-- (closed <=> both NULL; open_time < close_time) added in the `init`
-- migration — that constraint is left untouched.
-- ----------------------------------------------------------------------------
ALTER TABLE "court_schedule_day"
  ADD CONSTRAINT "court_schedule_day_lattice_align_check"
    CHECK (
      ("open_time" IS NULL OR "open_time" ~ ':(00|30)$')
      AND ("close_time" IS NULL OR "close_time" ~ ':(00|30)$')
    );

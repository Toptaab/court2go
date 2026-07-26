import type { DayOfWeek, TimeOfDay } from '@repo/types';

/**
 * Thailand-only MVP (PRD NFR9) — no timezone is stored anywhere in the schema.
 * The tenant local timezone is fixed to ICT = UTC+7, no DST. If the platform
 * ever goes multi-region this becomes a per-tenant/branch setting (flag-worthy,
 * not implemented now).
 *
 * Shared by `AvailabilityService` (grid preview) and `BookingService`
 * (authoritative hold creation / promo re-derivation) — ONE implementation of
 * the ICT wall-clock math, per the M6 build note (do not re-duplicate this).
 */
export const ICT_OFFSET_MINUTES = 420;

/** JS `Date.getUTCDay()` (0=SUN..6=SAT) → the platform's `DayOfWeek` enum. */
const WEEKDAY_BY_JS_DAY: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Combine an ICT calendar date (`YYYY-MM-DD`) and wall-clock time (`HH:MM`,
 * `24:00` permitted for end-of-day close) into the equivalent UTC instant.
 */
export function ictLocalToUtc(date: string, time: TimeOfDay): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - ICT_OFFSET_MINUTES * 60_000);
}

/** The `DayOfWeek` (ICT calendar date) the queried date falls on — NOT the host-tz weekday. */
export function resolveDayOfWeek(date: string): DayOfWeek {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAY_BY_JS_DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/**
 * Inverse of `ictLocalToUtc` — resolve a UTC instant (e.g. a client-supplied
 * Hold `start`) into its ICT wall-clock calendar date (`YYYY-MM-DD`) and
 * minutes-since-midnight. Used by `BookingService` to derive the Court
 * schedule day + grid `startMinutes` for a Hold from the UTC instant the
 * contract carries (`createHoldBodySchema.start`).
 */
export function utcToIctParts(instant: Date): { date: string; minutes: number } {
  const ict = new Date(instant.getTime() + ICT_OFFSET_MINUTES * 60_000);
  const y = ict.getUTCFullYear();
  const m = ict.getUTCMonth() + 1;
  const d = ict.getUTCDate();
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const minutes = ict.getUTCHours() * 60 + ict.getUTCMinutes();
  return { date, minutes };
}

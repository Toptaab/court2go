import type { IsoDate } from '@repo/types';

/**
 * MVP assumption (lead decision, carried flag): the platform is Thai-only and
 * has no per-tenant/branch timezone column yet. Every court's wall-clock
 * schedule/peak times are interpreted in a FIXED Asia/Bangkok offset (+07:00,
 * no DST) to produce UTC instants. A future schema addition should introduce a
 * real per-tenant/branch timezone column and replace this constant; until
 * then, this is the ONE place that offset is applied so the computed grid and
 * the stored `booking_slot.slot_start` stay in the same instant space.
 */
export const BANGKOK_UTC_OFFSET_MINUTES = 420;

/**
 * Convert a wall-clock instant expressed as a Bangkok-local calendar date
 * (`YYYY-MM-DD`) plus minutes-since-midnight into the equivalent UTC `Date`.
 * `minutesSinceMidnight` may be 1440 (the "24:00" end-of-day close sentinel
 * permitted by `timeOfDaySchema`) — `Date.UTC` overflow naturally rolls that
 * into the next day, which is exactly the desired half-open window boundary.
 */
export function bangkokLocalToUtc(date: IsoDate, minutesSinceMidnight: number): Date {
  const [year, month, day] = date.split('-').map(Number);
  const utcMs =
    Date.UTC(year, month - 1, day, 0, minutesSinceMidnight, 0, 0) -
    BANGKOK_UTC_OFFSET_MINUTES * 60_000;
  return new Date(utcMs);
}

const DAY_ORDER = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

/**
 * Day-of-week (Mon..Sun keys) of a `YYYY-MM-DD` calendar date. A plain
 * calendar date carries no instant/timezone ambiguity — it is already "the
 * Bangkok-local date requested" — so this only needs to index into
 * `DAY_ORDER`, not apply the UTC offset.
 */
export function bangkokDayOfWeek(date: IsoDate): (typeof DAY_ORDER)[number] {
  const [year, month, day] = date.split('-').map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return DAY_ORDER[jsDay];
}

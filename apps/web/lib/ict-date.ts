/**
 * ICT (UTC+7 fixed, no DST — CLAUDE.md "Timezone" invariant) calendar-date
 * helpers for date-picker UI (public court detail M10.3, admin walk-in
 * M10.8). Kept separate from `lib/format.ts` (which formats an already-known
 * UTC ISO instant for display) — these instead GENERATE the `YYYY-MM-DD`
 * date-picker options a user chooses from, before any instant exists.
 */

/** Today's date in ICT, as `YYYY-MM-DD`. */
export function todayIct(): string {
  const now = new Date();
  const ict = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return ict.toISOString().slice(0, 10);
}

/** `count` consecutive dates starting today (ICT), as `YYYY-MM-DD` strings. */
export function ictDateOptions(count: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  const ictOffset = 7 * 60 * 60 * 1000;
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() + ictOffset + i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * `<input type="datetime-local">` wall-clock string (`YYYY-MM-DDTHH:mm`) →
 * UTC ISO instant, treating the input as ICT (fixed UTC+7 — CLAUDE.md
 * "Timezone" invariant) regardless of the browser/OS local timezone.
 *
 * `new Date(localDateTime).toISOString()` is WRONG here: it parses the
 * wall-clock string in the browser's LOCAL timezone, so an admin whose OS
 * clock isn't Asia/Bangkok would create the block for the wrong UTC window
 * (court-blocks maintenance windows, PRD A5.1 AC5).
 */
export function ictLocalToUtcIso(localDateTime: string): string {
  const [datePart, timePart] = localDateTime.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - 7 * 60 * 60 * 1000).toISOString();
}

const THAI_DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/** `YYYY-MM-DD` → short Thai-day-name label, e.g. `"จ 28/07"`. */
export function formatIctDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const day = THAI_DAY_NAMES[date.getDay()];
  return `${day} ${d}/${m}`;
}

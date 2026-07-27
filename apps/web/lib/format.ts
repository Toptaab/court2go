import type { ThbAmount } from '@repo/types';

/**
 * Display-only formatters — THB currency + ICT (Indochina Time, UTC+7
 * fixed, no DST) date/time. Mirrors the CLAUDE.md invariant "Timezone:
 * ICT = UTC+7 fixed (Thailand-only, no tz stored)": the API always emits
 * UTC instants (`isoDateTimeSchema`) and NEVER a timezone offset, so every
 * conversion to a wall-clock Thai time happens here, at the display edge.
 *
 * `Asia/Bangkok` has no DST and has been UTC+7 continuously since 1920, so
 * asking `Intl` for that IANA zone is equivalent to a fixed +7 offset —
 * it's used here (rather than hand-rolled `+7*60` arithmetic) only
 * because `Intl.DateTimeFormat` already handles the calendar/day-rollover
 * math correctly and is available in every runtime `apps/web` targets.
 *
 * NEVER compute or derive a price here — every `ThbAmount` comes from the
 * server (satang, integer, see `@repo/types` `thbAmountSchema`); these
 * functions only format a value the API already returned.
 *
 * Pair these with the `.font-score` utility class (`app/globals.css`) when
 * rendering in the UI — times/prices/booking codes use the `--mono`
 * "scoreboard" numerals per docs/DESIGN.md, e.g.:
 *   <span className="font-score">{formatTHB(booking.totalAmount)}</span>
 */

const ICT_TIME_ZONE = 'Asia/Bangkok';

const thbFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  currencyDisplay: 'symbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `ThbAmount` (integer satang) → localized THB currency string, e.g. `"฿300.00"`. */
export function formatTHB(amountSatang: ThbAmount): string {
  return thbFormatter.format(amountSatang / 100);
}

/**
 * `ThbAmount` (integer satang) → plain THB number string for a form input,
 * e.g. `30000` → `"300.00"`. Pair with `thbInputToSatang` at the same field
 * — catalog editors (M10.9) are the only place `apps/web` round-trips a
 * satang amount through an editable number input rather than only displaying it.
 */
export function satangToThbInput(amountSatang: ThbAmount): string {
  return (amountSatang / 100).toFixed(2);
}

/**
 * THB form-input string → integer satang (`ThbAmount`), e.g. `"300"` → `30000`.
 * Rounds to the nearest satang — never trust float THB arithmetic past 2dp.
 * Returns `NaN` for an unparseable input; callers validate via the zod
 * `thbAmountSchema` (int, non-negative) before submit either way.
 */
export function thbInputToSatang(input: string): number {
  return Math.round(Number(input) * 100);
}

const ictDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ICT_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const ictTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ICT_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const ictDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ICT_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** UTC ISO instant → ICT calendar date, e.g. `"27 Jul 2026"`. */
export function formatIctDate(iso: string): string {
  return ictDateFormatter.format(new Date(iso));
}

/** UTC ISO instant → ICT 24h wall-clock time, e.g. `"16:00"`. */
export function formatIctTime(iso: string): string {
  return ictTimeFormatter.format(new Date(iso));
}

/** UTC ISO instant → ICT date + time, e.g. `"27 Jul 2026, 16:00"`. */
export function formatIctDateTime(iso: string): string {
  // en-GB's default "27 Jul 2026, 16:00" already reads naturally; reuse the
  // single combined formatter rather than concatenating the two above so
  // there's exactly one Intl call (and one place to change the separator).
  return ictDateTimeFormatter.format(new Date(iso));
}

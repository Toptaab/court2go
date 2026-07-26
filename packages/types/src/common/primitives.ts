import { z } from 'zod';

/**
 * Shared scalar primitives. One definition each, reused everywhere so validation
 * rules (phone format, money unit, time format) can never drift between the two apps.
 */

/** UUID v4 identifier used for every entity PK/FK across the platform. */
export const idSchema = z.string().uuid();
export type Id = z.infer<typeof idSchema>;

/**
 * Tenant slug — unique platform-wide, used for public URL routing (`/[tenantSlug]/...`)
 * and public tenant resolution. Lowercase kebab-case. (ARCHITECTURE §2.2)
 */
export const slugSchema = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case');
export type Slug = z.infer<typeof slugSchema>;

/**
 * Thai mobile phone number, national format: 10 digits starting with 0
 * (e.g. "0812345678"). Thailand-only in MVP (PRD NFR9). Server stores normalized
 * to this canonical form; clients may input with spaces/dashes but the contract
 * carries the normalized value.
 */
export const thaiPhoneSchema = z
  .string()
  .regex(/^0\d{9}$/, 'must be a 10-digit Thai mobile number starting with 0');
export type ThaiPhone = z.infer<typeof thaiPhoneSchema>;

/**
 * Monetary amount in **THB minor units (satang), integer, non-negative**.
 * 1 THB = 100 satang; e.g. 300.00 THB is `30000`.
 *
 * DECISION/FLAG (prisma-data): all money on the wire is integer satang to keep
 * money exact through percentage-promo math and PromptPay's 2-decimal amount.
 * The DB should store the same integer unit (Prisma `Int`) — do NOT use float.
 * Human-facing formatting (÷100, thb symbol) is a `packages/domain`/UI concern.
 */
export const thbAmountSchema = z.number().int().nonnegative();
export type ThbAmount = z.infer<typeof thbAmountSchema>;

/** ISO-8601 instant in UTC, e.g. "2026-07-26T09:00:00.000Z". */
export const isoDateTimeSchema = z.string().datetime();
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

/** Calendar date, `YYYY-MM-DD`, interpreted in the tenant/branch local timezone. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
export type IsoDate = z.infer<typeof isoDateSchema>;

/**
 * Wall-clock time of day, `HH:MM` 24h (00:00–24:00). Used for court open/close
 * hours and peak-range boundaries. "24:00" is permitted to express end-of-day close.
 */
export const timeOfDaySchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'must be HH:MM (00:00–24:00)');
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

/**
 * A `TimeOfDay` additionally constrained to the platform-wide 30-minute lock
 * lattice: the minute component MUST be `:00` or `:30`. `24:00` passes (ends in
 * `:00`, end-of-day close).
 *
 * WHY (ARCHITECTURE §5.1/§5.4 — "silent double-book" risk): the internal lock
 * lattice `booking_slot.slot_start` is fixed to the :00/:30 30-min grid. A court's
 * per-day `openTime` ANCHORS its start-time grid; if that anchor is itself off the
 * :00/:30 lattice, every computed grid start lands off-lattice, so holds are
 * rejected OFF_LATTICE (M6) and an on-lattice booking could overlap an off-lattice
 * one in real time yet share no `(court_id, slot_start)` pair. Constraining the
 * schedule's open/close to this lattice closes that at the contract layer.
 *
 * Reuse this ONLY for the court schedule open/close. `timeOfDaySchema` itself stays
 * unconstrained — peak-range boundaries use it and must NOT be lattice-aligned.
 */
export const latticeAlignedTimeSchema = timeOfDaySchema.refine(
  (t) => t.endsWith(':00') || t.endsWith(':30'),
  { message: 'must fall on the 30-min lattice (minute component :00 or :30)' },
);
export type LatticeAlignedTime = z.infer<typeof latticeAlignedTimeSchema>;

/** A URL (used for logos, news images, presigned upload/download, QR data-URLs). */
export const urlSchema = z.string().url();

/** CSS-hex color, e.g. "#0C8C6A" — tenant CI/brand color (DESIGN tokens). */
export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color');
export type HexColor = z.infer<typeof hexColorSchema>;

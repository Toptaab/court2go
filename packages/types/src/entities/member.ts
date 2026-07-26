import { z } from 'zod';
import { idSchema, thaiPhoneSchema, isoDateTimeSchema } from '../common/index';
import { sexSchema } from '../enums/index';

/**
 * Member (PRD §4) — a client identified by phone WITHIN a tenant (unique on
 * (tenantId, phone), ARCHITECTURE §2.3). `phone` may be null for a LINE-login
 * member who hasn't bound a phone yet. `phoneVerified` is the SEPARATE gate that
 * governs booking eligibility (not session state) — ARCHITECTURE §3.3.
 */
export const memberSchema = z.object({
  id: idSchema,
  phone: thaiPhoneSchema.nullable(),
  phoneVerified: z.boolean(),

  // Optional profile fields (PRD C6.1) — never required to book.
  name: z.string().max(120).nullable(),
  emergencyContact: z.string().max(120).nullable(),
  sex: sexSchema.nullable(),

  /** LINE OA binding state (ARCHITECTURE §4.2). Bound => notifications delivered. */
  lineBound: z.boolean(),
  /** Whether this member authenticated via LINE at least once. */
  hasLineLogin: z.boolean(),

  /** Admin-set block (PRD A7.1 AC3). Blocked members cannot complete new bookings. */
  isBlocked: z.boolean(),

  createdAt: isoDateTimeSchema,
});
export type Member = z.infer<typeof memberSchema>;

/**
 * "Me" — the current member's own view of their account (session-scoped).
 * Same shape as Member minus admin-only fields the client shouldn't reason about.
 */
export const meSchema = memberSchema.omit({ isBlocked: true });
export type Me = z.infer<typeof meSchema>;

/**
 * Admin's view of a Member in Member Management (PRD A7). Adds lightweight
 * aggregates the list/detail screens (DESIGN D12) show.
 */
export const memberAdminViewSchema = memberSchema.extend({
  bookingCount: z.number().int(),
  lastBookingAt: isoDateTimeSchema.nullable(),
});
export type MemberAdminView = z.infer<typeof memberAdminViewSchema>;

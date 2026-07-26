import { z } from 'zod';

/**
 * Shared enums — the frozen vocabularies both apps AND prisma-data bind to.
 * Values match ARCHITECTURE §6 state machines exactly (SCREAMING_SNAKE_CASE),
 * so a Prisma enum can be declared 1:1 against these.
 */

/* ------------------------------------------------------------------ Booking */

/**
 * Booking status machine (ARCHITECTURE §6.1). EXPIRED is reachable from
 * PENDING_VERIFICATION for BOTH branch types (ADR-0006 gap fix), not QR-only.
 */
export const bookingStatusSchema = z.enum([
  'PENDING_VERIFICATION', // Hold created, grid units reserved, phone not yet verified
  'PENDING_PAYMENT', // QR branch only: verified, awaiting slip upload
  'PENDING_PAYMENT_CONFIRMATION', // QR branch only: slip uploaded, awaiting admin review
  'CONFIRMED', // Payment ∈ {CONFIRMED, PAY_ONSITE_NOT_COLLECTED}
  'CANCELLATION_REQUESTED', // client requested cancel >2h before start, awaiting admin
  'REJECTED', // QR branch only: admin rejected slip; grid freed
  'EXPIRED', // Hold window elapsed (either branch type); grid freed
  'CANCELLED', // admin cancelled directly, or approved a cancellation request
  'COMPLETED', // admin-manual, MVP
  'NO_SHOW', // admin-manual, MVP
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export const BOOKING_STATUSES = bookingStatusSchema.options;

/* ------------------------------------------------------------------ Payment */

/** Payment status machine (ARCHITECTURE §6.2). */
export const paymentStatusSchema = z.enum([
  'AWAITING_SLIP_UPLOAD', // QR branch: booking entered PENDING_PAYMENT
  'SLIP_UPLOADED_PENDING_REVIEW', // QR branch: client uploaded slip
  'CONFIRMED', // QR branch: admin confirmed (slip or direct walk-in confirm)
  'REJECTED', // QR branch: admin rejected slip
  'PAY_ONSITE_NOT_COLLECTED', // Pay-Onsite branch: terminal, no money collected online
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export const PAYMENT_STATUSES = paymentStatusSchema.options;

/* ------------------------------------------------------------------ Branch payment method */

/** Per-Branch payment method (PRD 6a). Never mixed, per branch at a time. */
export const branchPaymentMethodSchema = z.enum(['PAY_ONSITE', 'QR_CODE']);
export type BranchPaymentMethod = z.infer<typeof branchPaymentMethodSchema>;
export const BRANCH_PAYMENT_METHODS = branchPaymentMethodSchema.options;

/* ------------------------------------------------------------------ Roles */

/** Admin roles (PRD A9 / ARCHITECTURE §3.3). */
export const roleSchema = z.enum(['OWNER', 'ADMIN', 'BRANCH_ADMIN']);
export type Role = z.infer<typeof roleSchema>;
export const ROLES = roleSchema.options;

/* ------------------------------------------------------------------ Member / auth */

/** Optional Member "sex" profile field (PRD C6.1). */
export const sexSchema = z.enum(['MALE', 'FEMALE', 'OTHER']);
export type Sex = z.infer<typeof sexSchema>;

/** OTP purpose: LOGIN establishes/renews session; BIND attaches a phone to an existing (LINE) Member. */
export const otpPurposeSchema = z.enum(['LOGIN', 'BIND']);
export type OtpPurpose = z.infer<typeof otpPurposeSchema>;

/** How a booking's Member identity was verified — audit trail on the Booking. */
export const verifiedViaSchema = z.enum([
  'SELF_OTP', // client completed OTP (or already phoneVerified) themselves
  'ADMIN_OVERRIDE', // staff walk-in creation, no OTP (PRD A2.2 AC2)
]);
export type VerifiedVia = z.infer<typeof verifiedViaSchema>;

/* ------------------------------------------------------------------ Promotion */

export const discountTypeSchema = z.enum(['PERCENTAGE', 'FIXED']);
export type DiscountType = z.infer<typeof discountTypeSchema>;

/* ------------------------------------------------------------------ News */

export const newsStatusSchema = z.enum(['DRAFT', 'PUBLISHED']);
export type NewsStatus = z.infer<typeof newsStatusSchema>;

/* ------------------------------------------------------------------ Court grid */

/**
 * The fixed grid-interval set (PRD §3, ARCHITECTURE §5.1). This is presentation/
 * pricing granularity; the internal lock lattice is always 30 min (§5.1) and is
 * NOT exposed here.
 */
export const gridIntervalMinutesSchema = z.union([
  z.literal(30),
  z.literal(60),
  z.literal(90),
  z.literal(120),
]);
export type GridIntervalMinutes = z.infer<typeof gridIntervalMinutesSchema>;
export const GRID_INTERVAL_MINUTES: readonly GridIntervalMinutes[] = [30, 60, 90, 120];

/** Day-of-week key for court schedules and peak ranges. */
export const dayOfWeekSchema = z.enum([
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
]);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
export const DAYS_OF_WEEK = dayOfWeekSchema.options;

/** Actor type for audit/session context (ARCHITECTURE §3.4). */
export const actorTypeSchema = z.enum(['MEMBER', 'ADMIN', 'SYSTEM']);
export type ActorType = z.infer<typeof actorTypeSchema>;

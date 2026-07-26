/**
 * Allowed Tenant Hold windows (ARCHITECTURE §6.1, §7): a PENDING_VERIFICATION /
 * PENDING_PAYMENT hold on a set of grid units is released after exactly 5 or 10
 * minutes if not converted. No other window is valid.
 */
export const HOLD_WINDOW_MINUTES = [5, 10] as const;
export type HoldWindowMinutes = (typeof HOLD_WINDOW_MINUTES)[number];

/**
 * Compute a hold's expiry instant: `createdAt + windowMinutes`. Does not mutate
 * `createdAt`; returns a new `Date`.
 */
export function computeHoldExpiry(createdAt: Date, windowMinutes: HoldWindowMinutes): Date {
  return new Date(createdAt.getTime() + windowMinutes * 60_000);
}

/**
 * True once `now` reaches (or passes) `holdExpiresAt` — expiry is inclusive at
 * the boundary instant, i.e. a hold is considered expired exactly AT its expiry
 * time, not only strictly after it.
 */
export function isHoldExpired(holdExpiresAt: Date, now: Date): boolean {
  return now.getTime() >= holdExpiresAt.getTime();
}

/**
 * Milliseconds remaining until `holdExpiresAt`, floored at 0 (never negative)
 * once the hold has expired.
 */
export function remainingHoldMs(holdExpiresAt: Date, now: Date): number {
  return Math.max(0, holdExpiresAt.getTime() - now.getTime());
}

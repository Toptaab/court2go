'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  bookingDetailSchema,
  slipViewUrlResponseSchema,
  type AdminCreateBookingBody,
  type AdminModifyBookingBody,
  type AdminCancelBookingBody,
  type AdminSetBookingOutcomeBody,
  type AdminConfirmPaymentBody,
  type AdminRejectPaymentBody,
  type AdminCancellationDecisionBody,
  type BookingDetail,
} from '@repo/types';
import { apiFetch } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * Admin booking action mutations (M10.8, PRD A2.2–A2.4). Every hook here
 * follows the same shape: `apiFetch` + `bookingDetailSchema` (the endpoints
 * all return the updated `BookingDetail`), then on success refresh the three
 * places a booking can be seen from — its own detail cache, the filtered
 * list/queue pages (D2/D4/D5), and the calendar (D1) — since any of these
 * actions can change a booking's status/paymentStatus enough to move it in
 * or out of a queue's filter. Invalidating by PREFIX (`adminBookingsListPrefix`
 * / `adminCalendarPrefix`) rather than one exact key is deliberate: the list/
 * calendar hooks key on their current filter params, which this mutation
 * hook has no visibility into.
 */
function invalidateBookingViews(
  qc: ReturnType<typeof useQueryClient>,
  bookingId: string,
  data: BookingDetail,
) {
  qc.setQueryData(queryKeys.adminBookingDetail(bookingId), data);
  qc.invalidateQueries({ queryKey: queryKeys.adminBookingsListPrefix() });
  qc.invalidateQueries({ queryKey: queryKeys.adminCalendarPrefix() });
}

/**
 * POST /admin/bookings — staff walk-in create (PRD A2.2). 201 BookingDetail;
 * 409 SLOT_UNAVAILABLE | DUPLICATE_MEMBER surfaced via `messageForError` at
 * the call site (no booking id to invalidate yet, so only list/calendar
 * views are refreshed here — the caller routes to the new booking's own
 * detail page on success, which fetches fresh).
 */
export function useAdminWalkInCreate() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminCreateBookingBody) =>
      apiFetch('/admin/bookings', bookingDetailSchema, { tenantSlug: slug, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminBookingsListPrefix() });
      qc.invalidateQueries({ queryKey: queryKeys.adminCalendarPrefix() });
    },
  });
}

/**
 * PATCH /admin/bookings/{bookingId} — modify court/start/slotCount (PRD A2.1
 * AC3). Atomic release-then-reinsert server-side; 409 SLOT_UNAVAILABLE rolls
 * the whole modify back, original booking untouched.
 */
export function useAdminModifyBooking(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminModifyBookingBody) =>
      apiFetch(`/admin/bookings/${encodeURIComponent(bookingId)}`, bookingDetailSchema, {
        tenantSlug: slug,
        method: 'PATCH',
        body,
      }),
    onSuccess: (data) => invalidateBookingViews(qc, bookingId, data),
  });
}

/** POST /admin/bookings/{bookingId}/cancel — admin-initiated cancel (PRD A2.1). */
export function useAdminCancelBooking(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminCancelBookingBody) =>
      apiFetch(`/admin/bookings/${encodeURIComponent(bookingId)}/cancel`, bookingDetailSchema, {
        tenantSlug: slug,
        body,
      }),
    onSuccess: (data) => invalidateBookingViews(qc, bookingId, data),
  });
}

/** POST /admin/bookings/{bookingId}/outcome — mark COMPLETED / NO_SHOW (PRD A2.1 AC4). */
export function useAdminSetOutcome(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminSetBookingOutcomeBody) =>
      apiFetch(`/admin/bookings/${encodeURIComponent(bookingId)}/outcome`, bookingDetailSchema, {
        tenantSlug: slug,
        body,
      }),
    onSuccess: (data) => invalidateBookingViews(qc, bookingId, data),
  });
}

/** POST /admin/bookings/{bookingId}/payment/confirm — confirm a slip / cash (PRD A2.3 AC2). */
export function useAdminConfirmPayment(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminConfirmPaymentBody) =>
      apiFetch(
        `/admin/bookings/${encodeURIComponent(bookingId)}/payment/confirm`,
        bookingDetailSchema,
        { tenantSlug: slug, body },
      ),
    onSuccess: (data) => invalidateBookingViews(qc, bookingId, data),
  });
}

/** POST /admin/bookings/{bookingId}/payment/reject — reject a slip (PRD A2.3 AC3), reason required. */
export function useAdminRejectPayment(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminRejectPaymentBody) =>
      apiFetch(
        `/admin/bookings/${encodeURIComponent(bookingId)}/payment/reject`,
        bookingDetailSchema,
        { tenantSlug: slug, body },
      ),
    onSuccess: (data) => invalidateBookingViews(qc, bookingId, data),
  });
}

/**
 * GET /admin/bookings/{bookingId}/payment/slip-url — lazy fetch of a fresh
 * short-lived signed slip image URL (ARCHITECTURE §4.4: "issued on demand").
 * Modeled as a no-arg mutation rather than a `useQuery` — it's an
 * explicit "view slip" action, never auto-run/cached, and each click should
 * mint a fresh URL rather than reuse a possibly-expired one.
 */
export function useAdminSlipViewUrl(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  return useMutation({
    mutationFn: () =>
      apiFetch(
        `/admin/bookings/${encodeURIComponent(bookingId)}/payment/slip-url`,
        slipViewUrlResponseSchema,
        { tenantSlug: slug, method: 'GET' },
      ),
  });
}

/**
 * POST /admin/bookings/{bookingId}/cancellation-decision — approve/decline a
 * client's cancellation request (PRD A2.4, the D5 queue).
 */
export function useAdminCancellationDecision(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminCancellationDecisionBody) =>
      apiFetch(
        `/admin/bookings/${encodeURIComponent(bookingId)}/cancellation-decision`,
        bookingDetailSchema,
        { tenantSlug: slug, body },
      ),
    onSuccess: (data) => invalidateBookingViews(qc, bookingId, data),
  });
}

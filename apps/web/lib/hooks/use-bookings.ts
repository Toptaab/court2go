'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createHoldResponseSchema,
  bookingDetailSchema,
  bookingListItemSchema,
  paginated,
  type CreateHoldBody,
  type ApplyPromoBody,
  type CancellationRequestBody,
} from '@repo/types';
import { apiFetch, apiFetchVoid, toQueryString } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

// --- Paginated booking list schema ---
const paginatedBookingsSchema = paginated(bookingListItemSchema);

/**
 * POST /courts/{courtId}/holds — create a hold (booking).
 * Returns the booking detail + nextStep for the flow.
 */
export function useCreateHold(courtId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateHoldBody) =>
      apiFetch(
        `/courts/${encodeURIComponent(courtId)}/holds`,
        createHoldResponseSchema,
        { tenantSlug: slug, body },
      ),
    onSuccess: (data) => {
      // Pre-populate the booking detail cache
      qc.setQueryData(queryKeys.bookingDetail(data.booking.id), data.booking);
      // Invalidate my bookings list
      qc.invalidateQueries({ queryKey: ['member', 'bookings', 'list'] });
    },
  });
}

/**
 * GET /bookings/{bookingId} — fetch booking detail.
 */
export function useBookingDetail(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.bookingDetail(bookingId),
    queryFn: () =>
      apiFetch(`/bookings/${encodeURIComponent(bookingId)}`, bookingDetailSchema, {
        tenantSlug: slug,
      }),
    enabled: bookingId.length > 0,
  });
}

/**
 * GET /me/bookings — paginated list of the member's bookings.
 */
export function useMyBookings(scope: 'upcoming' | 'past' | 'all' = 'all', page = 1) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.myBookings(scope, page),
    queryFn: () =>
      apiFetch(
        `/me/bookings${toQueryString({ scope, page })}`,
        paginatedBookingsSchema,
        { tenantSlug: slug },
      ),
  });
}

/**
 * POST /bookings/{bookingId}/promotion — apply a promo code.
 * Returns updated booking detail.
 */
export function useApplyPromo(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplyPromoBody) =>
      apiFetch(
        `/bookings/${encodeURIComponent(bookingId)}/promotion`,
        bookingDetailSchema,
        { tenantSlug: slug, body },
      ),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.bookingDetail(bookingId), data);
    },
  });
}

/**
 * DELETE /bookings/{bookingId}/promotion — remove the applied promo.
 * Returns updated booking detail.
 */
export function useRemovePromo(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(
        `/bookings/${encodeURIComponent(bookingId)}/promotion`,
        bookingDetailSchema,
        { tenantSlug: slug, method: 'DELETE' },
      ),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.bookingDetail(bookingId), data);
    },
  });
}

/**
 * POST /bookings/{bookingId}/cancellation-request — request cancellation.
 */
export function useCancellationRequest(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CancellationRequestBody) =>
      apiFetchVoid(
        `/bookings/${encodeURIComponent(bookingId)}/cancellation-request`,
        { tenantSlug: slug, body },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.bookingDetail(bookingId) });
      qc.invalidateQueries({ queryKey: ['member', 'bookings', 'list'] });
    },
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { adminCalendarItemSchema, bookingDetailSchema, bookingListItemSchema, paginated } from '@repo/types';
import { z } from 'zod';
import { apiFetch, toQueryString } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

// --- Schemas ---
const paginatedAdminBookingsSchema = paginated(bookingListItemSchema);

// Calendar response item shape (`AdminCalendarItem` — `BookingListItem` +
// `courtId`) lives in @repo/types, not redefined locally (CLAUDE.md: never
// redefine a contract type in an app).
const calendarResponseSchema = z.array(adminCalendarItemSchema);

/**
 * GET /admin/bookings — paginated admin booking list with filters.
 */
export function useAdminBookings(params: {
  page?: number;
  status?: string;
  paymentStatus?: string;
  branchId?: string;
  sportId?: string;
  courtId?: string;
  phone?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminBookings(params),
    queryFn: () =>
      apiFetch(
        `/admin/bookings${toQueryString(params as Record<string, string | number | undefined>)}`,
        paginatedAdminBookingsSchema,
        { tenantSlug: slug },
      ),
  });
}

/**
 * GET /admin/bookings/calendar?branchId=...&date=...
 */
export function useAdminCalendar(branchId: string, date: string) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminCalendar(branchId, date),
    queryFn: () =>
      apiFetch(
        `/admin/bookings/calendar${toQueryString({ branchId, date })}`,
        calendarResponseSchema,
        { tenantSlug: slug },
      ),
    enabled: branchId.length > 0 && date.length > 0,
  });
}

/**
 * GET /admin/bookings/{bookingId} — admin booking detail.
 */
export function useAdminBookingDetail(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminBookingDetail(bookingId),
    queryFn: () =>
      apiFetch(`/admin/bookings/${encodeURIComponent(bookingId)}`, bookingDetailSchema, {
        tenantSlug: slug,
      }),
    enabled: bookingId.length > 0,
  });
}

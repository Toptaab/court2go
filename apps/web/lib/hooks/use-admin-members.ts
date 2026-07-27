'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  memberAdminViewSchema,
  bookingListItemSchema,
  paginated,
  type AdminBlockMemberBody,
} from '@repo/types';
import { apiFetch, toQueryString } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * Admin Members management (M10.10, PRD A7, Design D12) — search/list,
 * detail with booking-history aggregates, and the block/unblock action.
 */

const paginatedMembersSchema = paginated(memberAdminViewSchema);
const paginatedBookingsSchema = paginated(bookingListItemSchema);

/** GET /admin/members?page=&pageSize=&q= */
export function useAdminMembers(params: { page: number; q?: string }) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminMembers(params),
    queryFn: () =>
      apiFetch(`/admin/members${toQueryString(params)}`, paginatedMembersSchema, { tenantSlug: slug }),
  });
}

/** GET /admin/members/{id} */
export function useAdminMember(memberId: string) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminMemberDetail(memberId),
    queryFn: () =>
      apiFetch(`/admin/members/${encodeURIComponent(memberId)}`, memberAdminViewSchema, {
        tenantSlug: slug,
      }),
    enabled: memberId.length > 0,
  });
}

/** GET /admin/members/{id}/bookings?page=&pageSize= */
export function useAdminMemberBookings(memberId: string, page: number) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminMemberBookings(memberId, page),
    queryFn: () =>
      apiFetch(
        `/admin/members/${encodeURIComponent(memberId)}/bookings${toQueryString({ page })}`,
        paginatedBookingsSchema,
        { tenantSlug: slug },
      ),
    enabled: memberId.length > 0,
  });
}

/** POST /admin/members/{id}/block — 200 MemberAdminView (PRD A7.1 AC3). */
export function useBlockMember(memberId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminBlockMemberBody) =>
      apiFetch(`/admin/members/${encodeURIComponent(memberId)}/block`, memberAdminViewSchema, {
        tenantSlug: slug,
        body,
      }),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.adminMemberDetail(memberId), data);
      qc.invalidateQueries({ queryKey: queryKeys.adminMembersListPrefix() });
      qc.invalidateQueries({ queryKey: queryKeys.adminMemberDetail(memberId) });
    },
  });
}

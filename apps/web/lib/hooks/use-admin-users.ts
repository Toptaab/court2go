'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  adminUserSchema,
  rolesMatrixSchema,
  type AdminUser,
  type CreateAdminUserBody,
  type UpdateAdminUserBody,
} from '@repo/types';
import { apiFetch, apiFetchVoid } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * Admin-user management + roles matrix (M10.10, PRD A9, Design D16, ADR-0005).
 * `GET /admin/admin-users` returns a plain `AdminUser[]` (no pagination, no
 * single-GET endpoint) — like `useAdminSports`/`useAdminPromotions`, the
 * edit screen finds its initial value from this same list.
 *
 * ADR-0005 UI rules (server is the real guard — see components/admin/
 * admin-user-form.tsx and the admin-users list page for where these are
 * applied): never offer OWNER as a settable role; only OWNER may deactivate
 * an ADMIN; BRANCH_ADMIN requires branchId; an OWNER row gets no
 * edit/deactivate/delete affordances.
 */

const adminUsersListSchema = z.array(adminUserSchema);

/** GET /admin/admin-users */
export function useAdminUsers() {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminUsers(),
    queryFn: () => apiFetch('/admin/admin-users', adminUsersListSchema, { tenantSlug: slug }),
  });
}

function invalidateAdminUserViews(qc: ReturnType<typeof useQueryClient>, adminUserId: string, data?: AdminUser) {
  if (data) qc.setQueryData(queryKeys.adminUserDetail(adminUserId), data);
  qc.invalidateQueries({ queryKey: queryKeys.adminUsers() });
  qc.invalidateQueries({ queryKey: queryKeys.adminUserDetail(adminUserId) });
}

/**
 * POST /admin/admin-users — 201 AdminUser. May 403 `FORBIDDEN` (e.g. a
 * Branch-Admin, who cannot manage admin-users at all — surfaced via
 * `messageForError`, never silently swallowed).
 */
export function useCreateAdminUser() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAdminUserBody) =>
      apiFetch('/admin/admin-users', adminUserSchema, { tenantSlug: slug, body }),
    onSuccess: (data) => invalidateAdminUserViews(qc, data.id, data),
  });
}

/**
 * PATCH /admin/admin-users/{id} — 200 AdminUser. May 403
 * `OWNER_IMMUTABLE`/`FORBIDDEN` per ADR-0005 (e.g. an ADMIN deactivating
 * another ADMIN) — surfaced via `messageForError`.
 */
export function useUpdateAdminUser(adminUserId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAdminUserBody) =>
      apiFetch(`/admin/admin-users/${encodeURIComponent(adminUserId)}`, adminUserSchema, {
        tenantSlug: slug,
        method: 'PATCH',
        body,
      }),
    onSuccess: (data) => invalidateAdminUserViews(qc, adminUserId, data),
  });
}

/** DELETE /admin/admin-users/{id} — 204; 403 `OWNER_IMMUTABLE` refuses always on OWNER. */
export function useDeleteAdminUser(adminUserId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetchVoid(`/admin/admin-users/${encodeURIComponent(adminUserId)}`, {
        tenantSlug: slug,
        method: 'DELETE',
      }),
    onSuccess: () => invalidateAdminUserViews(qc, adminUserId),
  });
}

/** GET /admin/roles-matrix — declarative capability grid (Design D16). */
export function useRolesMatrix() {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminRolesMatrix(),
    queryFn: () => apiFetch('/admin/roles-matrix', rolesMatrixSchema, { tenantSlug: slug }),
  });
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSessionResponseSchema, type AdminLoginBody } from '@repo/types';
import { apiFetch, apiFetchVoid } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * POST /admin/auth/login — admin email+password login.
 */
export function useAdminLogin() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminLoginBody) =>
      apiFetch('/admin/auth/login', adminSessionResponseSchema, {
        tenantSlug: slug,
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminMe() });
    },
  });
}

/**
 * POST /admin/auth/logout — destroy the admin session.
 */
export function useAdminLogout() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetchVoid('/admin/auth/logout', {
        tenantSlug: slug,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminMe() });
    },
  });
}

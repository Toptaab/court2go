'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { meSchema, type UpdateProfileBody } from '@repo/types';
import { apiFetch } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * PATCH /me — update the current member's profile (M10.4, Design M17).
 * Invalidates `useMe` on success so the profile view refreshes.
 */
export function useUpdateProfile() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileBody) =>
      apiFetch('/me', meSchema, {
        tenantSlug: slug,
        method: 'PATCH',
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me() });
    },
  });
}

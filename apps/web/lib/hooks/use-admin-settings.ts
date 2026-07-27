'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  configSchema,
  brandingSchema,
  imageUploadUrlResponseSchema,
  type Config,
  type Branding,
  type ImageUploadUrlBody,
} from '@repo/types';
import { apiFetch } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * Admin Config + Branding + image-upload (M10.10, PRD A8, Design D14/D15).
 * Both Config and Branding are full-replace singletons (`PUT` takes the
 * WHOLE object — load current via GET, edit, PUT all fields; there is no
 * PATCH here, unlike the entity CRUD hooks elsewhere).
 */

/** GET /admin/config */
export function useAdminConfig() {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminConfig(),
    queryFn: () => apiFetch('/admin/config', configSchema, { tenantSlug: slug }),
  });
}

/** PUT /admin/config — 200 Config. Body must be the full `Config` object. */
export function useUpdateConfig() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Config) =>
      apiFetch('/admin/config', configSchema, { tenantSlug: slug, method: 'PUT', body }),
    onSuccess: (data) => qc.setQueryData(queryKeys.adminConfig(), data),
  });
}

/** GET /admin/branding */
export function useAdminBranding() {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminBranding(),
    queryFn: () => apiFetch('/admin/branding', brandingSchema, { tenantSlug: slug }),
  });
}

/** PUT /admin/branding — 200 Branding. Body must be the full `Branding` object. */
export function useUpdateBranding() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Branding) =>
      apiFetch('/admin/branding', brandingSchema, { tenantSlug: slug, method: 'PUT', body }),
    onSuccess: (data) => qc.setQueryData(queryKeys.adminBranding(), data),
  });
}

/**
 * POST /admin/uploads/image-url — presigned PUT for public images (LOGO,
 * NEWS). Mirrors the slip-upload flow (`use-payment.ts` `useSlipUploadUrl`)
 * but for public-read object-storage keys; consumed by
 * `components/admin/image-upload-field.tsx`, which does the actual
 * PUT-to-`uploadUrl` step. Not a `useMutation` invalidation target itself —
 * callers persist the returned `publicUrl` into their own form/mutation.
 */
export function useImageUploadUrl() {
  const slug = getDevDefaultTenantSlug();
  return useMutation({
    mutationFn: (body: ImageUploadUrlBody) =>
      apiFetch('/admin/uploads/image-url', imageUploadUrlResponseSchema, { tenantSlug: slug, body }),
  });
}

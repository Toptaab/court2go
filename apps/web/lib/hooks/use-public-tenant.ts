'use client';

import { useQuery } from '@tanstack/react-query';
import { publicTenantSchema } from '@repo/types';
import { apiFetch } from '../api-client';
import { queryKeys } from './query-keys';

/**
 * Sample typed query hook (M10.2 exit criterion: "a sample typed hook
 * round-trips one PUBLIC endpoint with zod parse") — `GET /tenants/by-slug/
 * {slug}`, the one unauthenticated tenant-resolution call every public page
 * bootstraps with (ARCHITECTURE §2.2). No `x-tenant-id` header on this one
 * call specifically: the slug in the URL path IS the lookup key
 * (`apps/api`'s `TenantController.bySlug`), unlike every other public
 * endpoint that needs the header once a tenant is resolved.
 *
 * This is intentionally the ONLY catalog hook this slice creates — real
 * catalog browsing (news/branches/sports/courts/availability) and the
 * `[tenantSlug]` route segment that supplies `slug` from the URL land in
 * M10.3. This one exists to prove the `apiFetch` + `lib/hooks/query-keys.ts`
 * pattern end-to-end for M10.3 to follow.
 */
export function usePublicTenant(slug: string) {
  return useQuery({
    queryKey: queryKeys.publicTenant(slug),
    queryFn: () => apiFetch(`/tenants/by-slug/${encodeURIComponent(slug)}`, publicTenantSchema),
    enabled: slug.length > 0,
  });
}

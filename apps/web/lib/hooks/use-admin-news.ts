'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newsSchema, paginated, type News, type UpsertNewsBody } from '@repo/types';
import { apiFetch, apiFetchVoid, toQueryString } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * Admin News CRUD (M10.10, PRD A10, Design D13). `GET /admin/news` is
 * paginated (unlike Promotions/Sports) and there is no single-News GET
 * endpoint. `useAdminNewsDetail` works around that by requesting the
 * largest allowed page (`pageSize: 100`, the `paginationQuerySchema` cap)
 * and finding the item client-side — acceptable at Tenant-News MVP scale;
 * flagged for api-designer if a Tenant ever needs more than 100 posts.
 */

const paginatedNewsSchema = paginated(newsSchema);
const NEWS_LOOKUP_PAGE_SIZE = 100;

/** GET /admin/news?page=&pageSize= */
export function useAdminNews(page: number) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminNews(page),
    queryFn: () =>
      apiFetch(`/admin/news${toQueryString({ page })}`, paginatedNewsSchema, { tenantSlug: slug }),
  });
}

/**
 * Best-effort single-News lookup for the edit screen — see file header. A
 * successful create/update elsewhere already seeds `adminNewsDetail(id)`
 * directly via `setQueryData`, so this network round-trip is only hit on a
 * fresh navigation/reload straight to `/admin/news/{id}`.
 */
export function useAdminNewsDetail(newsId: string) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminNewsDetail(newsId),
    queryFn: async () => {
      const page = await apiFetch(
        `/admin/news${toQueryString({ page: 1, pageSize: NEWS_LOOKUP_PAGE_SIZE })}`,
        paginatedNewsSchema,
        { tenantSlug: slug },
      );
      const found = page.items.find((n) => n.id === newsId);
      if (!found) throw new Error('News item not found');
      return found;
    },
    enabled: newsId.length > 0,
  });
}

function invalidateNewsViews(qc: ReturnType<typeof useQueryClient>, newsId: string, data?: News) {
  if (data) qc.setQueryData(queryKeys.adminNewsDetail(newsId), data);
  qc.invalidateQueries({ queryKey: queryKeys.adminNewsListPrefix() });
  qc.invalidateQueries({ queryKey: queryKeys.adminNewsDetail(newsId) });
}

/** POST /admin/news — 201 News */
export function useCreateNews() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertNewsBody) => apiFetch('/admin/news', newsSchema, { tenantSlug: slug, body }),
    onSuccess: (data) => invalidateNewsViews(qc, data.id, data),
  });
}

/** PATCH /admin/news/{id} — 200 News */
export function useUpdateNews(newsId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertNewsBody) =>
      apiFetch(`/admin/news/${encodeURIComponent(newsId)}`, newsSchema, {
        tenantSlug: slug,
        method: 'PATCH',
        body,
      }),
    onSuccess: (data) => invalidateNewsViews(qc, newsId, data),
  });
}

/** DELETE /admin/news/{id} — 204 No Content */
export function useDeleteNews(newsId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetchVoid(`/admin/news/${encodeURIComponent(newsId)}`, { tenantSlug: slug, method: 'DELETE' }),
    onSuccess: () => invalidateNewsViews(qc, newsId),
  });
}

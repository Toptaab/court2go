'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  promotionSchema,
  promotionUsageItemSchema,
  lifecycleResultSchema,
  paginated,
  type Promotion,
  type UpsertPromotionBody,
} from '@repo/types';
import { apiFetch, toQueryString } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * Admin Promotions CRUD + usage (M10.10, PRD A6, Design D11). Same shape as
 * `use-admin-catalog.ts` — every query hook `apiFetch` + zod-parses the
 * named `@repo/types` schema; every mutation invalidates the list + detail
 * keys on success. `GET /admin/promotions` returns a plain `Promotion[]`
 * (no pagination, like Branches/Sports) — there is no single-Promotion GET
 * endpoint, so the edit screen finds its initial value from this same list
 * (mirrors the Sport editor's pattern, `use-admin-catalog.ts` `useAdminSports`).
 */

const promotionsListSchema = z.array(promotionSchema);
const paginatedPromotionUsageSchema = paginated(promotionUsageItemSchema);

/** GET /admin/promotions */
export function useAdminPromotions() {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminPromotions(),
    queryFn: () => apiFetch('/admin/promotions', promotionsListSchema, { tenantSlug: slug }),
  });
}

function invalidatePromotionViews(qc: ReturnType<typeof useQueryClient>, promotionId: string, data?: Promotion) {
  if (data) qc.setQueryData(queryKeys.adminPromotionDetail(promotionId), data);
  qc.invalidateQueries({ queryKey: queryKeys.adminPromotions() });
  qc.invalidateQueries({ queryKey: queryKeys.adminPromotionDetail(promotionId) });
}

/** POST /admin/promotions — 201 Promotion */
export function useCreatePromotion() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertPromotionBody) =>
      apiFetch('/admin/promotions', promotionSchema, { tenantSlug: slug, body }),
    onSuccess: (data) => invalidatePromotionViews(qc, data.id, data),
  });
}

/** PATCH /admin/promotions/{id} — 200 Promotion */
export function useUpdatePromotion(promotionId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertPromotionBody) =>
      apiFetch(`/admin/promotions/${encodeURIComponent(promotionId)}`, promotionSchema, {
        tenantSlug: slug,
        method: 'PATCH',
        body,
      }),
    onSuccess: (data) => invalidatePromotionViews(qc, promotionId, data),
  });
}

/** DELETE /admin/promotions/{id} — 200 LifecycleResult */
export function useDeletePromotion(promotionId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/promotions/${encodeURIComponent(promotionId)}`, lifecycleResultSchema, {
        tenantSlug: slug,
        method: 'DELETE',
      }),
    onSuccess: () => invalidatePromotionViews(qc, promotionId),
  });
}

/** POST /admin/promotions/{id}/deactivate — 200 LifecycleResult */
export function useDeactivatePromotion(promotionId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/promotions/${encodeURIComponent(promotionId)}/deactivate`, lifecycleResultSchema, {
        tenantSlug: slug,
      }),
    onSuccess: () => invalidatePromotionViews(qc, promotionId),
  });
}

/** GET /admin/promotions/{id}/usage?page=&pageSize= — redemption history (PRD A6.1 AC4). */
export function useAdminPromotionUsage(promotionId: string, page: number) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminPromotionUsage(promotionId, page),
    queryFn: () =>
      apiFetch(
        `/admin/promotions/${encodeURIComponent(promotionId)}/usage${toQueryString({ page })}`,
        paginatedPromotionUsageSchema,
        { tenantSlug: slug },
      ),
    enabled: promotionId.length > 0,
  });
}

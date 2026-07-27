'use client';

import { useQuery } from '@tanstack/react-query';
import {
  publicBranchSchema,
  publicSportSchema,
  publicCourtSchema,
  publicNewsSchema,
  availabilityResponseSchema,
  paginated,
} from '@repo/types';
import { z } from 'zod';
import { apiFetch, toQueryString } from '../api-client';
import { queryKeys } from './query-keys';

// --- Paginated news schema (built from the generic `paginated` helper) ---
const paginatedNewsSchema = paginated(publicNewsSchema);

/**
 * Paginated news feed — `GET /news?page=N&pageSize=M`.
 * Only PUBLISHED news returned publicly (server enforces).
 */
export function useNews(slug: string, page = 1, pageSize = 10) {
  return useQuery({
    queryKey: queryKeys.news(slug, page),
    queryFn: () =>
      apiFetch(
        `/news${toQueryString({ page, pageSize })}`,
        paginatedNewsSchema,
        { tenantSlug: slug },
      ),
    enabled: slug.length > 0,
  });
}

/**
 * Single news detail — `GET /news/{id}`.
 */
export function useNewsDetail(slug: string, newsId: string) {
  return useQuery({
    queryKey: queryKeys.newsDetail(slug, newsId),
    queryFn: () =>
      apiFetch(`/news/${encodeURIComponent(newsId)}`, publicNewsSchema, {
        tenantSlug: slug,
      }),
    enabled: slug.length > 0 && newsId.length > 0,
  });
}

// --- Branches list schema (non-paginated array) ---
const branchesListSchema = z.array(publicBranchSchema);

/**
 * All active branches — `GET /branches`.
 */
export function useBranches(slug: string) {
  return useQuery({
    queryKey: queryKeys.branches(slug),
    queryFn: () =>
      apiFetch('/branches', branchesListSchema, { tenantSlug: slug }),
    enabled: slug.length > 0,
  });
}

// --- Sports list schema (non-paginated array) ---
const sportsListSchema = z.array(publicSportSchema);

/**
 * Sports for a branch — `GET /branches/{branchId}/sports`.
 */
export function useSports(slug: string, branchId: string) {
  return useQuery({
    queryKey: queryKeys.sports(slug, branchId),
    queryFn: () =>
      apiFetch(
        `/branches/${encodeURIComponent(branchId)}/sports`,
        sportsListSchema,
        { tenantSlug: slug },
      ),
    enabled: slug.length > 0 && branchId.length > 0,
  });
}

// --- Courts list schema (non-paginated array) ---
const courtsListSchema = z.array(publicCourtSchema);

/**
 * Courts for a branch — `GET /branches/{branchId}/courts`.
 */
export function useCourts(slug: string, branchId: string) {
  return useQuery({
    queryKey: queryKeys.courts(slug, branchId),
    queryFn: () =>
      apiFetch(
        `/branches/${encodeURIComponent(branchId)}/courts`,
        courtsListSchema,
        { tenantSlug: slug },
      ),
    enabled: slug.length > 0 && branchId.length > 0,
  });
}

/**
 * Single court detail — `GET /courts/{courtId}`.
 */
export function useCourtDetail(slug: string, courtId: string) {
  return useQuery({
    queryKey: queryKeys.courtDetail(slug, courtId),
    queryFn: () =>
      apiFetch(`/courts/${encodeURIComponent(courtId)}`, publicCourtSchema, {
        tenantSlug: slug,
      }),
    enabled: slug.length > 0 && courtId.length > 0,
  });
}

/**
 * Per-court availability for a date — `GET /courts/{courtId}/availability?date=YYYY-MM-DD`.
 * Returns the start-time grid with free/taken status and per-slot-count price preview.
 */
export function useAvailability(slug: string, courtId: string, date: string) {
  return useQuery({
    queryKey: queryKeys.availability(slug, courtId, date),
    queryFn: () =>
      apiFetch(
        `/courts/${encodeURIComponent(courtId)}/availability${toQueryString({ date })}`,
        availabilityResponseSchema,
        { tenantSlug: slug },
      ),
    enabled: slug.length > 0 && courtId.length > 0 && date.length > 0,
  });
}

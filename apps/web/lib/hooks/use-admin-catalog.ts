'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  branchSchema,
  sportSchema,
  courtSchema,
  courtBlockSchema,
  lifecycleResultSchema,
  type Branch,
  type Court,
  type UpsertBranchBody,
  type UpsertSportBody,
  type UpsertCourtBody,
  type CreateCourtBlockBody,
} from '@repo/types';
import { apiFetch, apiFetchVoid, toQueryString } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * Admin catalog CRUD (M10.9, PRD A3/A4/A5 — Sports/Branches/Courts). Same
 * shape as `lib/hooks/use-admin-booking-actions.ts`: every query hook
 * `apiFetch` + zod-parses the named `@repo/types` schema; every mutation
 * hook invalidates the relevant list (by PREFIX where a filter param — here
 * `branchId` — means the mutation can't know every open list's exact key)
 * and detail keys on success.
 */

const branchesListSchema = z.array(branchSchema);
const sportsListSchema = z.array(sportSchema);
const courtsListSchema = z.array(courtSchema);
const courtBlocksListSchema = z.array(courtBlockSchema);

/* ================================================================= Branches */

/** GET /admin/branches */
export function useAdminBranches() {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminBranches(),
    queryFn: () => apiFetch('/admin/branches', branchesListSchema, { tenantSlug: slug }),
  });
}

/** GET /admin/branches/{id} */
export function useAdminBranch(branchId: string) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminBranchDetail(branchId),
    queryFn: () =>
      apiFetch(`/admin/branches/${encodeURIComponent(branchId)}`, branchSchema, {
        tenantSlug: slug,
      }),
    enabled: branchId.length > 0,
  });
}

function invalidateBranchViews(qc: ReturnType<typeof useQueryClient>, branchId: string, data?: Branch) {
  if (data) qc.setQueryData(queryKeys.adminBranchDetail(branchId), data);
  qc.invalidateQueries({ queryKey: queryKeys.adminBranches() });
  qc.invalidateQueries({ queryKey: queryKeys.adminBranchDetail(branchId) });
}

/** POST /admin/branches — 201 Branch */
export function useCreateBranch() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertBranchBody) =>
      apiFetch('/admin/branches', branchSchema, { tenantSlug: slug, body }),
    onSuccess: (data) => invalidateBranchViews(qc, data.id, data),
  });
}

/** PATCH /admin/branches/{id} — 200 Branch */
export function useUpdateBranch(branchId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertBranchBody) =>
      apiFetch(`/admin/branches/${encodeURIComponent(branchId)}`, branchSchema, {
        tenantSlug: slug,
        method: 'PATCH',
        body,
      }),
    onSuccess: (data) => invalidateBranchViews(qc, branchId, data),
  });
}

/** DELETE /admin/branches/{id} — soft-delete; 409 SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS if future bookings exist. */
export function useDeleteBranch(branchId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/branches/${encodeURIComponent(branchId)}`, lifecycleResultSchema, {
        tenantSlug: slug,
        method: 'DELETE',
      }),
    onSuccess: () => invalidateBranchViews(qc, branchId),
  });
}

/** POST /admin/branches/{id}/deactivate — always allowed. */
export function useDeactivateBranch(branchId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/branches/${encodeURIComponent(branchId)}/deactivate`, lifecycleResultSchema, {
        tenantSlug: slug,
      }),
    onSuccess: () => invalidateBranchViews(qc, branchId),
  });
}

/* =================================================================== Sports */

/** GET /admin/sports */
export function useAdminSports() {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminSports(),
    queryFn: () => apiFetch('/admin/sports', sportsListSchema, { tenantSlug: slug }),
  });
}

function invalidateSportViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.adminSports() });
}

/** POST /admin/sports — 201 Sport */
export function useCreateSport() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertSportBody) =>
      apiFetch('/admin/sports', sportSchema, { tenantSlug: slug, body }),
    onSuccess: () => invalidateSportViews(qc),
  });
}

/** PATCH /admin/sports/{id} — 200 Sport */
export function useUpdateSport(sportId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertSportBody) =>
      apiFetch(`/admin/sports/${encodeURIComponent(sportId)}`, sportSchema, {
        tenantSlug: slug,
        method: 'PATCH',
        body,
      }),
    onSuccess: () => invalidateSportViews(qc),
  });
}

/** DELETE /admin/sports/{id} — soft-delete; 409 SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS if future bookings exist. */
export function useDeleteSport(sportId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/sports/${encodeURIComponent(sportId)}`, lifecycleResultSchema, {
        tenantSlug: slug,
        method: 'DELETE',
      }),
    onSuccess: () => invalidateSportViews(qc),
  });
}

/** POST /admin/sports/{id}/deactivate — always allowed. */
export function useDeactivateSport(sportId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/sports/${encodeURIComponent(sportId)}/deactivate`, lifecycleResultSchema, {
        tenantSlug: slug,
      }),
    onSuccess: () => invalidateSportViews(qc),
  });
}

/* =================================================================== Courts */

/** GET /admin/courts?branchId= — `branchId` omitted lists every court in scope. */
export function useAdminCourts(branchId?: string) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminCourts(branchId),
    queryFn: () =>
      apiFetch(`/admin/courts${toQueryString({ branchId })}`, courtsListSchema, {
        tenantSlug: slug,
      }),
  });
}

/** GET /admin/courts/{id} */
export function useAdminCourt(courtId: string) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminCourtDetail(courtId),
    queryFn: () =>
      apiFetch(`/admin/courts/${encodeURIComponent(courtId)}`, courtSchema, { tenantSlug: slug }),
    enabled: courtId.length > 0,
  });
}

function invalidateCourtViews(qc: ReturnType<typeof useQueryClient>, courtId: string, data?: Court) {
  if (data) qc.setQueryData(queryKeys.adminCourtDetail(courtId), data);
  qc.invalidateQueries({ queryKey: queryKeys.adminCourtsListPrefix() });
  qc.invalidateQueries({ queryKey: queryKeys.adminCourtDetail(courtId) });
}

/**
 * POST /admin/courts — 201 Court. May 403 `BRANCH_SCOPE_DENIED` for a
 * Branch-Admin targeting a Branch outside their scope (PRD A5.1 AC1) —
 * surface via `messageForError`, do not hide the form.
 */
export function useCreateCourt() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertCourtBody) =>
      apiFetch('/admin/courts', courtSchema, { tenantSlug: slug, body }),
    onSuccess: (data) => invalidateCourtViews(qc, data.id, data),
  });
}

/** PATCH /admin/courts/{id} — 200 Court. Same `BRANCH_SCOPE_DENIED` note as create. */
export function useUpdateCourt(courtId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertCourtBody) =>
      apiFetch(`/admin/courts/${encodeURIComponent(courtId)}`, courtSchema, {
        tenantSlug: slug,
        method: 'PATCH',
        body,
      }),
    onSuccess: (data) => invalidateCourtViews(qc, courtId, data),
  });
}

/** DELETE /admin/courts/{id} — soft-delete; 409 SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS if future bookings exist. */
export function useDeleteCourt(courtId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/courts/${encodeURIComponent(courtId)}`, lifecycleResultSchema, {
        tenantSlug: slug,
        method: 'DELETE',
      }),
    onSuccess: () => invalidateCourtViews(qc, courtId),
  });
}

/** POST /admin/courts/{id}/deactivate — always allowed. */
export function useDeactivateCourt(courtId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/courts/${encodeURIComponent(courtId)}/deactivate`, lifecycleResultSchema, {
        tenantSlug: slug,
      }),
    onSuccess: () => invalidateCourtViews(qc, courtId),
  });
}

/* ============================================================== Court blocks */

/** GET /admin/courts/{id}/blocks (PRD A5.1 AC5 — maintenance blocking). */
export function useAdminCourtBlocks(courtId: string) {
  const slug = getDevDefaultTenantSlug();
  return useQuery({
    queryKey: queryKeys.adminCourtBlocks(courtId),
    queryFn: () =>
      apiFetch(`/admin/courts/${encodeURIComponent(courtId)}/blocks`, courtBlocksListSchema, {
        tenantSlug: slug,
      }),
    enabled: courtId.length > 0,
  });
}

/** POST /admin/courts/{id}/blocks — 201 CourtBlock */
export function useCreateCourtBlock(courtId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCourtBlockBody) =>
      apiFetch(`/admin/courts/${encodeURIComponent(courtId)}/blocks`, courtBlockSchema, {
        tenantSlug: slug,
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminCourtBlocks(courtId) }),
  });
}

/** DELETE /admin/courts/{id}/blocks/{blockId} — 204 No Content. */
export function useDeleteCourtBlock(courtId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) =>
      apiFetchVoid(
        `/admin/courts/${encodeURIComponent(courtId)}/blocks/${encodeURIComponent(blockId)}`,
        { tenantSlug: slug, method: 'DELETE' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminCourtBlocks(courtId) }),
  });
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMe, fetchAdminMe } from './session';
import { queryKeys } from '../hooks/query-keys';

/**
 * Client-side "who am I" for the Member session (M10.2 exit: "useMe...
 * resolve against a running API"). `null` data means "not logged in" (see
 * `fetchMe`'s null-on-401 contract) — a well-formed, cacheable result, not
 * an error state, so components branch on `data === null` rather than
 * `isError`. Later slices (M10.4+) call `queryClient.invalidateQueries({
 * queryKey: queryKeys.me() })` after login/logout to refresh this.
 */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => fetchMe(),
  });
}

/** Client-side "who am I" for the AdminUser session — same shape as `useMe`. */
export function useAdminMe() {
  return useQuery({
    queryKey: queryKeys.adminMe(),
    queryFn: () => fetchAdminMe(),
  });
}

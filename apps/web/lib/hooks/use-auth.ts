'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  otpRequestResponseSchema,
  memberSessionResponseSchema,
  lineLoginUrlResponseSchema,
  type OtpRequestBody,
  type OtpVerifyBody,
  type LineCallbackBody,
} from '@repo/types';
import { apiFetch, apiFetchVoid } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * Member auth mutations (M10.4). Each invalidates `queryKeys.me()` on
 * success so `useMe` (lib/auth/hooks.ts) refreshes automatically.
 */

/** POST /auth/otp/request — send an OTP to the member's phone. */
export function useOtpRequest() {
  const slug = getDevDefaultTenantSlug();
  return useMutation({
    mutationFn: (body: OtpRequestBody) =>
      apiFetch('/auth/otp/request', otpRequestResponseSchema, {
        tenantSlug: slug,
        body,
      }),
  });
}

/** POST /auth/otp/verify — verify the OTP code and establish a session. */
export function useOtpVerify() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OtpVerifyBody) =>
      apiFetch('/auth/otp/verify', memberSessionResponseSchema, {
        tenantSlug: slug,
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me() });
    },
  });
}

/** GET /auth/line/login-url — get the LINE OAuth authorization URL. */
export function useLineLoginUrl() {
  const slug = getDevDefaultTenantSlug();
  return useMutation({
    mutationFn: () =>
      apiFetch('/auth/line/login-url', lineLoginUrlResponseSchema, {
        tenantSlug: slug,
      }),
  });
}

/** POST /auth/line/callback — exchange the LINE authorization code for a session. */
export function useLineCallback() {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LineCallbackBody) =>
      apiFetch('/auth/line/callback', memberSessionResponseSchema, {
        tenantSlug: slug,
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me() });
    },
  });
}

/** POST /auth/logout — destroy the member session (cookie cleared server-side). */
export function useLogout() {
  const qc = useQueryClient();
  const slug = getDevDefaultTenantSlug();
  return useMutation({
    mutationFn: () =>
      apiFetchVoid('/auth/logout', {
        tenantSlug: slug,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.me() });
    },
  });
}

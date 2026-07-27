'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  slipUploadUrlResponseSchema,
  bookingDetailSchema,
  type SlipUploadUrlBody,
  type ConfirmSlipBody,
} from '@repo/types';
import { apiFetch } from '../api-client';
import { getDevDefaultTenantSlug } from '../tenant';
import { queryKeys } from './query-keys';

/**
 * POST /bookings/{bookingId}/payment/slip-upload-url
 * Request a presigned PUT URL to upload the slip image directly to object storage.
 */
export function useSlipUploadUrl(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  return useMutation({
    mutationFn: (body: SlipUploadUrlBody) =>
      apiFetch(
        `/bookings/${encodeURIComponent(bookingId)}/payment/slip-upload-url`,
        slipUploadUrlResponseSchema,
        { tenantSlug: slug, body },
      ),
  });
}

/**
 * POST /bookings/{bookingId}/payment/slip
 * Confirm that the slip was uploaded (objectKey from the presigned URL).
 * Moves booking → PENDING_PAYMENT_CONFIRMATION.
 */
export function useConfirmSlip(bookingId: string) {
  const slug = getDevDefaultTenantSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfirmSlipBody) =>
      apiFetch(
        `/bookings/${encodeURIComponent(bookingId)}/payment/slip`,
        bookingDetailSchema,
        { tenantSlug: slug, body },
      ),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.bookingDetail(bookingId), data);
      qc.invalidateQueries({ queryKey: ['member', 'bookings', 'list'] });
    },
  });
}

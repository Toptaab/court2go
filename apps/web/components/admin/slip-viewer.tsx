'use client';

import { useState } from 'react';
import { useAdminSlipViewUrl } from '@/lib/hooks/use-admin-booking-actions';
import { messageForError } from '@/lib/error';
import { formatIctDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';

/**
 * On-demand slip viewer (D4 slip-review queue + booking detail). The slip
 * image lives behind a short-lived signed URL (ARCHITECTURE §4.4) — never
 * fetched eagerly, and never reused past its own `expiresAt`; every click
 * mints a fresh one via `useAdminSlipViewUrl`.
 */
export function SlipViewer({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const slipUrl = useAdminSlipViewUrl(bookingId);

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    slipUrl.mutate();
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleToggle}>
        {open ? 'ซ่อนสลิป / Hide slip' : 'ดูสลิป / View slip'}
      </Button>

      {open && slipUrl.isPending && (
        <div className="h-48 w-full animate-pulse rounded-card bg-surface-2" />
      )}

      {open && slipUrl.isError && (
        <p className="text-xs text-status-danger">{messageForError(slipUrl.error)}</p>
      )}

      {open && slipUrl.data && (
        <div className="flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a static asset */}
          <img
            src={slipUrl.data.slipUrl}
            alt="สลิปการชำระเงิน / Payment slip"
            className="max-h-96 w-full rounded-card border border-line-100 object-contain"
          />
          <p className="text-xs text-fg-muted">
            ลิงก์หมดอายุ / Link expires: {formatIctDateTime(slipUrl.data.expiresAt)}
          </p>
        </div>
      )}
    </div>
  );
}

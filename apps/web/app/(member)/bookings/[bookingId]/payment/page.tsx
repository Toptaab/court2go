'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBookingDetail } from '@/lib/hooks/use-bookings';
import { useSlipUploadUrl, useConfirmSlip } from '@/lib/hooks/use-payment';
import { formatTHB } from '@/lib/format';
import { messageForError } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { PaymentStatusBadge } from '@/components/ui/badge';

type UploadState = 'idle' | 'requesting-url' | 'uploading' | 'confirming' | 'done';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AcceptedType = (typeof ACCEPTED_TYPES)[number];

/**
 * Payment page (Design M10). PromptPay QR + slip upload with countdown timer.
 *
 * Visual spec from design:
 * - Hold timer ring with countdown at top
 * - QR box with PromptPay badge, QR image, bold amount
 * - Info banner explaining the flow
 * - Upload slip section
 * - Submit slip CTA in action bar at bottom
 */
export default function PaymentPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { data: booking, isLoading, isError } = useBookingDetail(params.bookingId);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState<string>('--:--');

  const slipUploadUrl = useSlipUploadUrl(params.bookingId);
  const confirmSlip = useConfirmSlip(params.bookingId);

  // Calculate countdown from holdExpiresAt
  useEffect(() => {
    if (!booking?.holdExpiresAt) return;
    const expires = new Date(booking.holdExpiresAt).getTime();

    const tick = () => {
      const diff = Math.max(0, expires - Date.now());
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      if (diff <= 0) {
        clearInterval(interval);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [booking?.holdExpiresAt]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-64 animate-pulse rounded-card bg-surface-2" />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">ไม่พบการจอง / Booking not found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/bookings')}>
          ← กลับ / Back
        </Button>
      </div>
    );
  }

  const payment = booking.payment;
  const isAwaitingSlip = payment.status === 'AWAITING_SLIP_UPLOAD';
  const isPendingReview = payment.status === 'SLIP_UPLOADED_PENDING_REVIEW';
  const isConfirmed = payment.status === 'CONFIRMED';
  const isPayOnsite = payment.status === 'PAY_ONSITE_NOT_COLLECTED';
  const isRejected = payment.status === 'REJECTED';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type as AcceptedType)) {
      setError('Please select a JPEG, PNG, or WebP file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB).');
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleSubmitSlip = async () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }

    try {
      setUploadState('requesting-url');
      const { uploadUrl, objectKey, requiredHeaders } = await slipUploadUrl.mutateAsync({
        contentType: selectedFile.type as AcceptedType,
        contentLength: selectedFile.size,
      });

      setUploadState('uploading');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: requiredHeaders,
        body: selectedFile,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');

      setUploadState('confirming');
      await confirmSlip.mutateAsync({ objectKey });
      setUploadState('done');
    } catch (err) {
      setUploadState('idle');
      setError(messageForError(err));
    }
  };

  // === Pending confirmation (M11 — slip uploaded) ===
  if (isPendingReview) {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-status-warn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-status-warn">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
        <h2 className="text-center font-disp text-lg font-semibold text-fg">
          Awaiting venue confirmation
        </h2>
        <p className="text-center text-sm text-fg-muted">
          Your slip was received. We'll confirm your payment shortly.
        </p>
        <div className="flex gap-2">
          <span className="rounded-pill border border-status-warn/30 bg-status-warn/5 px-3 py-1 text-xs font-medium text-status-warn-ink">
            Pending Review
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/bookings')}>
          ← My Bookings
        </Button>
      </div>
    );
  }

  // === Confirmed (M12) ===
  if (isConfirmed) {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-ok/10">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-status-ok">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-center font-disp text-lg font-semibold text-status-ok">
          Booking confirmed!
        </h2>
        <p className="text-center text-sm text-fg-muted">
          Payment confirmed — see you at the court.
        </p>
        <Button variant="primary" onClick={() => router.push('/bookings')}>
          View My Bookings
        </Button>
      </div>
    );
  }

  // === Pay Onsite (M13) ===
  if (isPayOnsite) {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-pay-onsite/10">
          <span className="text-2xl">💰</span>
        </div>
        <h2 className="text-center font-disp text-lg font-semibold text-fg">
          Pay at venue
        </h2>
        <p className="text-center text-sm text-fg-muted">
          Booking confirmed. Please pay {formatTHB(payment.amountDue)} at the court.
        </p>
        <Button variant="primary" onClick={() => router.push('/bookings')}>
          View My Bookings
        </Button>
      </div>
    );
  }

  // === Rejected ===
  if (isRejected) {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-danger/10">
          <span className="text-2xl">✗</span>
        </div>
        <h2 className="text-center font-disp text-lg font-semibold text-status-danger">
          Payment rejected
        </h2>
        <p className="text-center text-sm text-fg-muted">
          {payment.rejectionReason || 'Your payment slip was not approved.'}
        </p>
        <Button variant="outline" onClick={() => router.push('/branches')}>
          Book again
        </Button>
      </div>
    );
  }

  // === Awaiting Slip Upload (M10 — main QR screen) ===
  return (
    <div className="flex flex-col gap-5">
      {/* Hold timer (Design M10 .hold with .ring countdown) */}
      {booking.holdExpiresAt && (
        <div className="flex items-center gap-3 rounded-lg border border-line-100 bg-surface p-3">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 border-accent">
            <span className="font-mono text-sm font-bold text-accent">{timeLeft}</span>
          </div>
          <p className="text-xs text-ink-700">
            Slot held — upload your slip before the timer ends or it's released.
          </p>
        </div>
      )}

      {/* QR Box (Design M10 .qrbox) */}
      {payment.qr && (
        <div className="rounded-lg border border-line-100 bg-surface p-5 text-center shadow-sm">
          <div className="mb-3">
            <span className="rounded-pill bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              PromptPay
            </span>
            <span className="ml-2 text-xs text-ink-500">generated for this booking</span>
          </div>
          {/* QR Image */}
          <img
            src={payment.qr.qrImageDataUrl}
            alt="PromptPay QR"
            className="mx-auto h-[172px] w-[172px] rounded-md"
          />
          {/* Amount */}
          <div className="mt-3 font-mono text-[30px] font-extrabold text-fg">
            {formatTHB(payment.amountDue)}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Amount pre-filled · PromptPay
          </p>
        </div>
      )}

      {/* Info banner (Design M10 .banner.b-info) */}
      <div className="flex gap-2 rounded-md bg-status-info/5 px-3 py-3 text-[12.5px] text-status-info">
        <span className="flex-none text-[15px]">ℹ</span>
        <span>
          Scan in your banking app — the amount is already filled in. Then upload your slip below.
        </span>
      </div>

      {/* Upload section (Design M10 .upload) */}
      <div
        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-line-300 bg-surface-2 p-6 transition-colors hover:border-accent"
        onClick={() => fileInputRef.current?.click()}
      >
        <b className="text-sm text-fg">Upload transfer slip</b>
        <p className="text-xs text-ink-500">Photo or screenshot · JPG / PNG</p>
        {selectedFile && (
          <p className="mt-2 text-xs font-medium text-accent">
            ✓ {selectedFile.name}
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error */}
      {error && (
        <div className="rounded-md border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-xs text-status-danger">{error}</p>
        </div>
      )}

      {/* Action bar (Design M10 actionbar) */}
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={uploadState !== 'idle' || (!selectedFile && uploadState === 'idle')}
          onClick={handleSubmitSlip}
        >
          {uploadState === 'idle' && 'Submit slip'}
          {uploadState === 'requesting-url' && 'Preparing...'}
          {uploadState === 'uploading' && 'Uploading...'}
          {uploadState === 'confirming' && 'Confirming...'}
          {uploadState === 'done' && 'Done ✓'}
        </Button>
        <p className="text-center text-xs text-ink-500">
          We manually confirm your payment — usually within 30 min.
        </p>
      </div>

      {/* Payment status */}
      <div className="flex items-center justify-center pt-2">
        <PaymentStatusBadge status={payment.status} />
      </div>
    </div>
  );
}

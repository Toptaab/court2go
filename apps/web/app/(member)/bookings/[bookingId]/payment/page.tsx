'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBookingDetail } from '@/lib/hooks/use-bookings';
import { useSlipUploadUrl, useConfirmSlip } from '@/lib/hooks/use-payment';
import { formatTHB } from '@/lib/format';
import { messageForError } from '@/lib/error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/ui/badge';

type UploadState = 'idle' | 'requesting-url' | 'uploading' | 'confirming' | 'done';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AcceptedType = (typeof ACCEPTED_TYPES)[number];

/**
 * Payment page (Design M10–M13). Handles:
 * - QR branch: shows PromptPay QR code + slip upload flow
 * - Pay-Onsite branch: shows confirmed-not-collected message
 * - Pending confirmation: shows waiting state
 * - Confirmed: shows success
 */
export default function PaymentPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { data: booking, isLoading, isError } = useBookingDetail(params.bookingId);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slipUploadUrl = useSlipUploadUrl(params.bookingId);
  const confirmSlip = useConfirmSlip(params.bookingId);

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
  const isPayOnsite = payment.status === 'PAY_ONSITE_NOT_COLLECTED';
  const isConfirmed = payment.status === 'CONFIRMED';
  const isPendingReview = payment.status === 'SLIP_UPLOADED_PENDING_REVIEW';
  const isAwaitingSlip = payment.status === 'AWAITING_SLIP_UPLOAD';
  const isRejected = payment.status === 'REJECTED';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type as AcceptedType)) {
      setError('กรุณาเลือกไฟล์ JPEG, PNG หรือ WebP / Please select a JPEG, PNG, or WebP file.');
      return;
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('ไฟล์ใหญ่เกินไป (สูงสุด 10MB) / File too large (max 10MB).');
      return;
    }

    setError(null);

    try {
      // Step 1: Get presigned upload URL
      setUploadState('requesting-url');
      const { uploadUrl, objectKey, requiredHeaders } = await slipUploadUrl.mutateAsync({
        contentType: file.type as AcceptedType,
        contentLength: file.size,
      });

      // Step 2: Upload file directly to object storage
      setUploadState('uploading');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: requiredHeaders,
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      // Step 3: Confirm slip with the API
      setUploadState('confirming');
      await confirmSlip.mutateAsync({ objectKey });

      setUploadState('done');
    } catch (err) {
      setUploadState('idle');
      setError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.push(`/bookings/${booking.id}`)}
        className="self-start text-sm text-accent hover:underline"
      >
        ← รายละเอียดการจอง / Booking detail
      </button>

      <div className="flex items-center justify-between">
        <h1 className="font-disp text-lg font-semibold text-fg">
          การชำระเงิน / Payment
        </h1>
        <PaymentStatusBadge status={payment.status} />
      </div>

      {/* Amount due */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <span className="text-sm text-fg-muted">ยอดชำระ / Amount due</span>
          <span className="font-score text-xl font-semibold text-accent">
            {formatTHB(payment.amountDue)}
          </span>
        </CardContent>
      </Card>

      {/* === Pay-Onsite confirmed === */}
      {isPayOnsite && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-pay-onsite/10">
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-center text-sm text-fg">
              การจองยืนยันแล้ว กรุณาชำระเงินที่สนาม
            </p>
            <p className="text-center text-xs text-fg-muted">
              Booking confirmed. Please pay at the venue.
            </p>
          </CardContent>
        </Card>
      )}

      {/* === QR branch: show PromptPay QR === */}
      {isAwaitingSlip && payment.qr && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-sm">
              สแกน QR เพื่อชำระเงิน / Scan QR to pay
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {/* QR Image */}
            <img
              src={payment.qr.qrImageDataUrl}
              alt="PromptPay QR"
              className="h-56 w-56"
            />
            <p className="font-score text-xs text-fg-muted">
              PromptPay · {formatTHB(payment.amountDue)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* === Slip upload section === */}
      {isAwaitingSlip && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm text-fg">
              หลังจากชำระเงินแล้ว กรุณาอัปโหลดสลิป /
              After payment, please upload your slip.
            </p>

            {error && (
              <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
                <p className="text-xs text-status-danger">{error}</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              variant="primary"
              className="w-full"
              disabled={uploadState !== 'idle'}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadState === 'idle' && 'อัปโหลดสลิป / Upload slip'}
              {uploadState === 'requesting-url' && 'กำลังเตรียม...'}
              {uploadState === 'uploading' && 'กำลังอัปโหลด...'}
              {uploadState === 'confirming' && 'กำลังยืนยัน...'}
              {uploadState === 'done' && 'เสร็จสิ้น ✓'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* === Pending confirmation (slip uploaded) === */}
      {isPendingReview && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6">
            <div className="h-8 w-8 animate-pulse rounded-full bg-status-info/20" />
            <p className="text-center text-sm text-fg">
              อัปโหลดสลิปเรียบร้อย รอการตรวจสอบจากแอดมิน
            </p>
            <p className="text-center text-xs text-fg-muted">
              Slip uploaded. Waiting for admin confirmation.
            </p>
          </CardContent>
        </Card>
      )}

      {/* === Confirmed (QR branch) === */}
      {isConfirmed && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-ok/10">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-center text-sm font-semibold text-status-ok">
              การชำระเงินยืนยันแล้ว
            </p>
            <p className="text-center text-xs text-fg-muted">
              Payment confirmed. See you at the court!
            </p>
          </CardContent>
        </Card>
      )}

      {/* === Rejected === */}
      {isRejected && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-danger/10">
              <span className="text-2xl">✗</span>
            </div>
            <p className="text-center text-sm font-semibold text-status-danger">
              การชำระเงินถูกปฏิเสธ
            </p>
            <p className="text-center text-xs text-fg-muted">
              Payment was rejected.
            </p>
            {payment.rejectionReason && (
              <p className="text-center text-xs text-fg-muted">
                เหตุผล: {payment.rejectionReason}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Booking status badge */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <span className="text-xs text-fg-muted">สถานะการจอง:</span>
        <BookingStatusBadge status={booking.status} />
      </div>
    </div>
  );
}

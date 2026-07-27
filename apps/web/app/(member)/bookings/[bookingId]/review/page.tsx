'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBookingDetail, useApplyPromo, useRemovePromo } from '@/lib/hooks/use-bookings';
import { formatTHB, formatIctDate, formatIctTime } from '@/lib/format';
import { messageForError } from '@/lib/error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/ui/badge';

/**
 * Booking review page (Design M6) — shown after hold creation.
 * Displays booking summary, price breakdown, promo apply/remove,
 * and navigation to next step (payment or confirmation).
 *
 * Price is DISPLAY ONLY from the server — never computed client-side.
 */
export default function BookingReviewPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { data: booking, isLoading, isError } = useBookingDetail(params.bookingId);

  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);

  const applyPromo = useApplyPromo(params.bookingId);
  const removePromo = useRemovePromo(params.bookingId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-40 animate-pulse rounded-card bg-surface-2" />
        <div className="h-20 animate-pulse rounded-card bg-surface-2" />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">ไม่พบการจอง / Booking not found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/branches')}>
          ← กลับ / Back
        </Button>
      </div>
    );
  }

  const hasPromo = booking.price.promotion !== null;

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError(null);
    if (!promoCode.trim()) return;
    try {
      await applyPromo.mutateAsync({ code: promoCode.trim() });
      setPromoCode('');
    } catch (err) {
      setPromoError(messageForError(err));
    }
  };

  const handleRemovePromo = async () => {
    setPromoError(null);
    try {
      await removePromo.mutateAsync();
    } catch (err) {
      setPromoError(messageForError(err));
    }
  };

  const handleContinue = () => {
    // Navigate based on booking status
    if (booking.status === 'PENDING_VERIFICATION') {
      // Need to verify phone first
      router.push('/login');
    } else if (booking.status === 'PENDING_PAYMENT') {
      // Go to payment page (M10.6)
      router.push(`/bookings/${booking.id}/payment`);
    } else {
      // Already confirmed or other terminal state
      router.push(`/bookings/${booking.id}`);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-disp text-lg font-semibold text-fg">
        สรุปการจอง / Booking Summary
      </h1>

      {/* Booking info card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{booking.context.courtName}</CardTitle>
            <BookingStatusBadge status={booking.status} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">สาขา / Branch</span>
            <span className="text-fg">{booking.context.branchName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">กีฬา / Sport</span>
            <span className="text-fg">{booking.context.sportName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">วันที่ / Date</span>
            <span className="font-score text-fg">{formatIctDate(booking.startsAt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">เวลา / Time</span>
            <span className="font-score text-fg">
              {formatIctTime(booking.startsAt)} – {formatIctTime(booking.endsAt)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">จำนวน / Slots</span>
            <span className="font-score text-fg">
              {booking.slotCount} ({booking.slotCount * booking.gridIntervalMinutes} นาที)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Price breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">ราคา / Price</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {/* Per-unit breakdown */}
          {booking.price.units.map((unit) => (
            <div key={unit.index} className="flex justify-between text-xs">
              <span className="text-fg-muted">
                {unit.startTime} {unit.isPeak ? '(Peak)' : '(Base)'}
              </span>
              <span className="font-score text-fg">{formatTHB(unit.unitPrice)}</span>
            </div>
          ))}

          {/* Subtotal */}
          <div className="flex justify-between border-t border-line-100 pt-2 text-sm">
            <span className="text-fg-muted">รวม / Subtotal</span>
            <span className="font-score text-fg">{formatTHB(booking.price.subtotal)}</span>
          </div>

          {/* Promotion discount */}
          {hasPromo && booking.price.promotion && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-status-ok">
                  โปรโมชั่น / Promo: {booking.price.promotion.code}
                </span>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  disabled={removePromo.isPending}
                  className="text-xs text-status-danger hover:underline"
                >
                  ลบ / Remove
                </button>
              </div>
              <span className="font-score text-status-ok">
                −{formatTHB(booking.price.promotion.discountAmount)}
              </span>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between border-t border-line-100 pt-2 text-sm font-semibold">
            <span className="text-fg">ยอดรวม / Total</span>
            <span className="font-score text-lg text-accent">
              {formatTHB(booking.price.total)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Promo code input (only if no promo applied yet) */}
      {!hasPromo && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleApplyPromo} className="flex flex-col gap-3">
              <label htmlFor="promo-code" className="text-sm font-medium text-fg">
                โค้ดโปรโมชั่น / Promo code
              </label>
              <div className="flex gap-2">
                <input
                  id="promo-code"
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="กรอกโค้ด"
                  maxLength={40}
                  className="flex-1 rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={applyPromo.isPending || !promoCode.trim()}
                >
                  {applyPromo.isPending ? '...' : 'ใช้ / Apply'}
                </Button>
              </div>
              {promoError && (
                <p className="text-xs text-status-danger">{promoError}</p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {/* Hold timer warning */}
      {booking.holdExpiresAt && (
        <p className="text-center text-xs text-status-warn">
          การจับจองจะหมดเวลาอัตโนมัติ กรุณาดำเนินการต่อ /
          Your hold will expire automatically. Please continue.
        </p>
      )}

      {/* Continue button */}
      <Button variant="primary" className="w-full" onClick={handleContinue}>
        ดำเนินการต่อ / Continue
      </Button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBookingDetail, useApplyPromo, useRemovePromo } from '@/lib/hooks/use-bookings';
import { formatTHB, formatIctDate, formatIctTime } from '@/lib/format';
import { messageForError } from '@/lib/error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/ui/badge';
import { StepDots } from '@/components/booking/step-dots';

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
      {/* Header with step indicator (Design M6 — Step 4/4) */}
      <div className="flex items-center justify-between">
        <h1 className="font-disp text-lg font-semibold text-fg">
          สรุปการจอง / Review booking
        </h1>
        <StepDots total={4} current={4} />
      </div>

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

      {/* Price breakdown (Design M6 priceline/totrow pattern) */}
      <Card>
        <CardContent className="flex flex-col gap-0 p-0">
          {/* Per-unit breakdown */}
          {booking.price.units.map((unit) => (
            <div key={unit.index} className="flex items-center justify-between px-4 py-2 text-[12.5px]">
              <span className="text-ink-700">
                {unit.startTime}{' '}
                <span className="font-mono text-[11.5px] text-ink-500">
                  · {unit.isPeak ? 'peak' : 'base'}
                </span>
              </span>
              <span className="font-mono font-semibold text-fg">{formatTHB(unit.unitPrice)}</span>
            </div>
          ))}

          {/* Promotion discount */}
          {hasPromo && booking.price.promotion && (
            <div className="flex items-center justify-between border-t border-line-100 px-4 py-2 text-[12.5px]">
              <div className="flex items-center gap-2">
                <span className="text-status-ok">
                  Promo: {booking.price.promotion.code}
                </span>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  disabled={removePromo.isPending}
                  className="text-[11px] text-status-danger hover:underline"
                >
                  ลบ / Remove
                </button>
              </div>
              <span className="font-mono font-semibold text-status-ok">
                −{formatTHB(booking.price.promotion.discountAmount)}
              </span>
            </div>
          )}

          {/* Total row */}
          <div className="flex items-center justify-between border-t border-line-100 px-4 py-3">
            <span className="text-sm font-semibold text-fg">Total due</span>
            <span className="font-mono text-lg font-bold text-accent">
              {formatTHB(booking.price.total)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Promo code input (Design M6 inpgroup style) */}
      {!hasPromo && (
        <form onSubmit={handleApplyPromo} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              id="promo-code"
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Add promo code"
              maxLength={40}
              className="flex-1 rounded-md border border-line-100 bg-surface px-3 py-3 font-mono text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(12,140,106,0.15)]"
            />
            <Button
              type="submit"
              variant="secondary"
              size="md"
              disabled={applyPromo.isPending || !promoCode.trim()}
              className="px-4"
            >
              {applyPromo.isPending ? '...' : 'Apply'}
            </Button>
          </div>
          {promoError && (
            <p className="text-xs text-status-danger">{promoError}</p>
          )}
          <p className="text-xs text-ink-500">
            Have a promo code? Apply it before you pay.
          </p>
        </form>
      )}

      {/* Info banner (Design M6 banner b-info) */}
      <div className="flex gap-2 rounded-md bg-status-info/5 px-3 py-3 text-[12.5px] text-status-info">
        <span className="flex-none text-[15px]">ℹ</span>
        <span>Sum of per-slot prices — each slot at its base or peak rate.</span>
      </div>

      {/* Hold timer warning */}
      {booking.holdExpiresAt && (
        <p className="text-center text-xs text-status-warn">
          Slot held — please continue before it expires.
        </p>
      )}

      {/* Action bar (Design M6 actionbar) */}
      <Button variant="primary" size="lg" className="w-full" onClick={handleContinue}>
        Confirm & Pay
      </Button>
    </div>
  );
}

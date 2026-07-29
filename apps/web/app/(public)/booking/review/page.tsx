'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCourtDetail } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { StepDots } from '@/components/booking/step-dots';
import { Button } from '@/components/ui/button';

/**
 * Booking Review — Design M6.
 * Shows booking summary (court, date, time, duration, price),
 * optional promo code input, and proceed to login/payment CTA.
 * Step 4 of 4 in the booking flow.
 */
export default function BookingReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = getDevDefaultTenantSlug();

  const courtId = searchParams.get('court') ?? '';
  const date = searchParams.get('date') ?? '';
  const startTime = searchParams.get('start') ?? '';
  const slots = parseInt(searchParams.get('slots') ?? '1', 10);

  const { data: court, isLoading } = useCourtDetail(slug, courtId);

  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');

  // Calculate derived values
  const gridInterval = court?.gridIntervalMinutes ?? 30;
  const durationMinutes = slots * gridInterval;
  const hours = durationMinutes / 60;
  const durationLabel = hours >= 1
    ? `${hours % 1 === 0 ? hours : hours.toFixed(1)} hr`
    : `${durationMinutes} min`;

  // Price estimate (base price × slots — actual price from server at hold time)
  const estimatedPrice = court ? court.basePricePerGridUnit * slots : 0;

  // Format date for display
  function formatDate(isoDate: string): string {
    try {
      const d = new Date(isoDate + 'T00:00:00');
      return d.toLocaleDateString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }

  function formatTime(t: string): string {
    return t.slice(0, 5);
  }

  function handleApplyPromo() {
    if (!promoCode.trim()) return;
    // Promo validation is done server-side at booking time.
    // Here we just store it locally for the flow.
    setPromoApplied(true);
    setPromoError('');
  }

  function handleClearPromo() {
    setPromoCode('');
    setPromoApplied(false);
    setPromoError('');
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="h-[38px] w-[38px] animate-pulse rounded-[10px] bg-surface-2" />
          <div className="h-5 w-40 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="h-48 animate-pulse rounded-card bg-surface-2" />
          <div className="h-14 animate-pulse rounded-card bg-surface-2" />
        </div>
      </div>
    );
  }

  // Missing params or court not found
  if (!court || !courtId || !date || !startTime) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink-700"
            aria-label="Go back"
          >
            ←
          </button>
          <span className="text-base font-bold text-fg">Review booking</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-fg-muted">
            ข้อมูลการจองไม่ครบถ้วน / Booking information incomplete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-80px)] flex-col">
      {/* App bar */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink-700"
          aria-label="Go back"
        >
          ←
        </button>
        <span className="text-base font-bold text-fg">Review booking</span>
        <div className="ml-auto">
          <StepDots total={4} current={4} />
        </div>
      </div>

      {/* Booking summary card */}
      <div className="flex-1 p-4">
        <div className="rounded-card border border-line bg-surface p-4">
          <h3 className="mb-3 text-sm font-bold text-fg">Booking summary</h3>

          <div className="space-y-2.5">
            <div className="flex items-start justify-between">
              <span className="text-xs text-fg-muted">Court</span>
              <span className="text-right text-sm font-medium text-fg">{court.name}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-xs text-fg-muted">Date</span>
              <span className="text-right text-sm font-medium text-fg">{formatDate(date)}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-xs text-fg-muted">Time</span>
              <span className="text-right text-sm font-medium text-fg">{formatTime(startTime)}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-xs text-fg-muted">Duration</span>
              <span className="text-right text-sm font-medium text-fg">
                {durationLabel} ({slots} slot{slots > 1 ? 's' : ''})
              </span>
            </div>

            <div className="my-2 border-t border-dashed border-line" />

            <div className="flex items-start justify-between">
              <span className="text-sm font-bold text-fg">Estimated total</span>
              <span className="text-base font-bold text-accent">฿{estimatedPrice}</span>
            </div>
          </div>
        </div>

        {/* Promo code section */}
        <div className="mt-4 rounded-card border border-line bg-surface p-4">
          <h3 className="mb-2.5 text-sm font-bold text-fg">Promotion code</h3>

          {promoApplied ? (
            <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
              <span className="flex-1 text-sm font-medium text-accent">{promoCode}</span>
              <button
                type="button"
                onClick={handleClearPromo}
                className="text-xs text-fg-muted hover:text-fg"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value.toUpperCase());
                  setPromoError('');
                }}
                placeholder="Enter code"
                className="flex-1 rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                disabled={!promoCode.trim()}
                className="rounded-lg bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          )}
          {promoError && (
            <p className="mt-1.5 text-xs text-status-error">{promoError}</p>
          )}
          <p className="mt-2 text-[11px] text-fg-muted">
            Discount will be calculated at payment confirmation.
          </p>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3">
        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            const params = new URLSearchParams({
              court: courtId,
              date,
              start: startTime,
              slots: String(slots),
              ...(promoApplied && promoCode ? { promo: promoCode } : {}),
            });
            router.push(`/booking/login?${params.toString()}`);
          }}
        >
          Confirm & Login
        </Button>
      </div>
    </div>
  );
}

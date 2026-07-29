'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

const PAYMENT_TIMEOUT_SECONDS = 15 * 60; // 15 minutes

/**
 * PromptPay QR Payment — Design M10.
 * Shows QR code for PromptPay payment with countdown timer.
 * After payment verification, redirects to confirmation.
 */
export default function BookingPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [timeLeft, setTimeLeft] = useState(PAYMENT_TIMEOUT_SECONDS);
  const [status, setStatus] = useState<'pending' | 'checking' | 'success' | 'expired'>('pending');

  const courtId = searchParams.get('court') ?? '';
  const date = searchParams.get('date') ?? '';
  const startTime = searchParams.get('start') ?? '';
  const slots = parseInt(searchParams.get('slots') ?? '1', 10);

  // Countdown timer
  useEffect(() => {
    if (status !== 'pending') return;
    if (timeLeft <= 0) {
      setStatus('expired');
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, status]);

  function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async function handleConfirmPayment() {
    setStatus('checking');
    try {
      // TODO: Call actual payment verification endpoint
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStatus('success');

      // Navigate to confirmation after brief success display
      setTimeout(() => {
        const params = new URLSearchParams({
          court: courtId,
          date,
          start: startTime,
          slots: String(slots),
        });
        router.push(`/booking/confirmed?${params.toString()}`);
      }, 1000);
    } catch {
      setStatus('pending');
    }
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
        <span className="text-base font-bold text-fg">Payment</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col items-center px-4 pt-6">
        {/* Timer */}
        <div className={`mb-4 rounded-full px-4 py-1.5 text-sm font-medium ${
          status === 'expired'
            ? 'bg-status-error/10 text-status-error'
            : timeLeft <= 60
              ? 'bg-status-warn/10 text-status-warn'
              : 'bg-accent/10 text-accent'
        }`}>
          {status === 'expired'
            ? 'Payment expired'
            : `Expires in ${formatCountdown(timeLeft)}`}
        </div>

        {/* QR Code area */}
        <div className="mb-4 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded-xl bg-surface-2">
            {/* QR placeholder — actual QR generation would use a library */}
            <div className="flex flex-col items-center gap-2 text-center">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" className="text-fg-muted/50">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="14" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M19 14v3m0 3h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-xs text-fg-muted">PromptPay QR</span>
            </div>
          </div>
        </div>

        {/* Payment info */}
        <div className="mb-4 w-full max-w-[280px] rounded-card border border-line bg-surface p-3.5 text-center">
          <div className="text-xs text-fg-muted">Amount</div>
          <div className="mt-0.5 text-2xl font-bold text-fg">
            ฿{(slots * 200).toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-fg-muted">
            Scan with any Thai banking app
          </div>
        </div>

        {/* Instructions */}
        <div className="w-full max-w-[280px] space-y-2 text-center">
          <p className="text-xs text-fg-muted">
            1. Open your banking app
          </p>
          <p className="text-xs text-fg-muted">
            2. Scan the QR code above
          </p>
          <p className="text-xs text-fg-muted">
            3. Confirm payment and tap &quot;I&apos;ve paid&quot; below
          </p>
        </div>

        {/* Success state */}
        {status === 'success' && (
          <div className="mt-6 flex items-center gap-2 rounded-full bg-status-ok/10 px-4 py-2 text-sm font-medium text-status-ok">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Payment confirmed!
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3">
        {status === 'expired' ? (
          <Button
            className="w-full"
            size="lg"
            variant="primary"
            onClick={() => router.back()}
          >
            Try again
          </Button>
        ) : (
          <Button
            className="w-full"
            size="lg"
            disabled={status === 'checking' || status === 'success'}
            onClick={handleConfirmPayment}
          >
            {status === 'checking'
              ? 'Checking...'
              : status === 'success'
                ? 'Redirecting...'
                : "I've paid"}
          </Button>
        )}
      </div>
    </div>
  );
}

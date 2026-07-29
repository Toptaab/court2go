'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * OTP Verification — Design M8.
 * 6-digit code input with auto-focus, resend countdown, and verification flow.
 */
export default function BookingOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const code = digits.join('');
  const isComplete = code.length === OTP_LENGTH && digits.every((d) => d !== '');

  const handleChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setError('');

    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setError('');

    // Focus the next empty or last
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  }

  async function handleVerify() {
    if (!isComplete) return;
    setIsVerifying(true);
    setError('');

    try {
      // TODO: Call actual OTP verify endpoint
      // For now, simulate and navigate to payment
      await new Promise((resolve) => setTimeout(resolve, 800));

      const params = new URLSearchParams(searchParams.toString());
      params.delete('phone');
      router.push(`/booking/payment?${params.toString()}`);
    } catch {
      setError('รหัสไม่ถูกต้อง / Invalid OTP code');
    } finally {
      setIsVerifying(false);
    }
  }

  function handleResend() {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(''));
    setError('');
    inputRefs.current[0]?.focus();
    // TODO: Call resend OTP endpoint
  }

  // Mask phone for display (e.g. 08X-XXX-1234)
  const maskedPhone = phone
    ? `${phone.slice(0, 3)}-XXX-${phone.slice(-4)}`
    : '';

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
        <span className="text-base font-bold text-fg">Verify OTP</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col items-center px-4 pt-10">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold text-fg">Enter verification code</h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            Sent to <span className="font-medium text-fg">{maskedPhone}</span>
          </p>
        </div>

        {/* OTP Input boxes */}
        <div className="flex gap-2.5" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`h-[52px] w-[44px] rounded-xl border text-center text-xl font-bold transition-all focus:outline-none ${
                error
                  ? 'border-status-error bg-status-error/5 text-status-error'
                  : digit
                    ? 'border-accent bg-accent/5 text-fg'
                    : 'border-line bg-paper text-fg focus:border-accent focus:ring-1 focus:ring-accent'
              }`}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-3 text-xs text-status-error">{error}</p>
        )}

        {/* Resend link */}
        <div className="mt-6">
          {cooldown > 0 ? (
            <span className="text-sm text-fg-muted">
              Resend in <span className="font-medium text-fg">{cooldown}s</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-sm font-medium text-accent hover:underline"
            >
              Resend code
            </button>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3">
        <Button
          className="w-full"
          size="lg"
          disabled={!isComplete || isVerifying}
          onClick={handleVerify}
        >
          {isVerifying ? 'Verifying...' : 'Verify'}
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Login / Phone Entry — Design M7.
 * User enters their phone number to receive OTP for booking confirmation.
 */
export default function BookingLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Validate Thai phone number format
  const isValidPhone = /^0[689]\d{8}$/.test(phone);

  function formatPhoneDisplay(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    setError('');
  }

  async function handleSubmit() {
    if (!isValidPhone) {
      setError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง / Please enter a valid phone number');
      return;
    }

    setIsSubmitting(true);
    try {
      // Pass all booking params + phone to OTP page
      const params = new URLSearchParams(searchParams.toString());
      params.set('phone', phone);
      router.push(`/booking/otp?${params.toString()}`);
    } catch {
      setError('เกิดข้อผิดพลาด / Something went wrong');
    } finally {
      setIsSubmitting(false);
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
        <span className="text-base font-bold text-fg">Login</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-4 pt-8">
        {/* Brand area */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <span className="text-2xl">🎾</span>
          </div>
          <h1 className="text-lg font-bold text-fg">Enter your phone number</h1>
          <p className="mt-1 text-sm text-fg-muted">
            We&apos;ll send a verification code via SMS
          </p>
        </div>

        {/* Phone input */}
        <div className="space-y-2">
          <label htmlFor="phone" className="block text-xs font-medium text-fg-muted">
            Phone number
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
            <span className="text-sm font-medium text-fg-muted">+66</span>
            <div className="h-5 w-px bg-line" />
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="08X-XXX-XXXX"
              value={formatPhoneDisplay(phone)}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="flex-1 bg-transparent text-[17px] font-medium text-fg tracking-wide placeholder:text-fg-muted/50 focus:outline-none"
            />
          </div>
          {error && (
            <p className="text-xs text-status-error">{error}</p>
          )}
          <p className="text-[11px] text-fg-muted">
            By continuing, you agree to our terms of service.
          </p>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3">
        <Button
          className="w-full"
          size="lg"
          disabled={!isValidPhone || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Sending...' : 'Send OTP'}
        </Button>
      </div>
    </div>
  );
}

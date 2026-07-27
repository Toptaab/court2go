'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOtpVerify, useOtpRequest } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { messageForError } from '@/lib/error';

/**
 * OTP entry content (Design M8). Receives `challengeId` and `phone` via query
 * params from the login page. Shows a 6-digit code input, countdown timer
 * for resend, and error handling for invalid/expired/max-attempts codes.
 */
export function OtpVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const challengeId = searchParams.get('challengeId') ?? '';
  const phone = searchParams.get('phone') ?? '';
  const devCode = searchParams.get('devCode');

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [currentChallengeId, setCurrentChallengeId] = useState(challengeId);
  const inputRef = useRef<HTMLInputElement>(null);

  const otpVerify = useOtpVerify();
  const otpResend = useOtpRequest();

  // Redirect to login if missing params
  useEffect(() => {
    if (!challengeId || !phone) {
      router.replace('/login');
    }
  }, [challengeId, phone, router]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus the input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length < 4) {
      setError('กรุณากรอกรหัส OTP / Please enter the OTP code.');
      return;
    }

    try {
      await otpVerify.mutateAsync({
        challengeId: currentChallengeId,
        code,
      });
      // Success — session cookie set, useMe will refresh, redirect to account
      router.replace('/account');
    } catch (err) {
      setError(messageForError(err));
      setCode('');
      inputRef.current?.focus();
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      const result = await otpResend.mutateAsync({
        phone,
        purpose: 'LOGIN',
      });
      setCurrentChallengeId(result.challengeId);
      setResendCooldown(60);
      setCode('');
      inputRef.current?.focus();
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleCodeChange = (value: string) => {
    // Allow only digits, max 8 chars
    const cleaned = value.replace(/\D/g, '').slice(0, 8);
    setCode(cleaned);
  };

  if (!challengeId || !phone) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-disp text-xl font-semibold text-fg">
          กรอกรหัส OTP / Enter OTP
        </h1>
        <p className="text-sm text-fg-muted">
          ส่งรหัสไปที่ {phone} / Code sent to {phone}
        </p>
      </div>

      {/* Dev code hint (only in dev mode) */}
      {devCode && (
        <div className="rounded-card border border-status-info/20 bg-status-info/5 px-3 py-2">
          <p className="font-score text-sm text-status-info">
            [DEV] OTP code: {devCode}
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-sm text-status-danger">{error}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="otp-code" className="text-sm font-medium text-fg">
                รหัส OTP / OTP Code
              </label>
              <input
                id="otp-code"
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="rounded-card border border-line-300 bg-surface px-3 py-3 text-center font-score text-2xl tracking-[0.3em] text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                maxLength={8}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={otpVerify.isPending || code.length < 4}
            >
              {otpVerify.isPending ? 'กำลังยืนยัน...' : 'ยืนยัน / Verify'}
            </Button>
          </form>

          {/* Resend */}
          <div className="mt-4 flex items-center justify-center">
            {resendCooldown > 0 ? (
              <p className="text-sm text-fg-muted">
                ส่งรหัสใหม่ได้ใน / Resend in{' '}
                <span className="font-score text-fg">{resendCooldown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={otpResend.isPending}
                className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
              >
                {otpResend.isPending
                  ? 'กำลังส่ง...'
                  : 'ส่งรหัสอีกครั้ง / Resend code'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Back to login */}
      <button
        type="button"
        onClick={() => router.push('/login')}
        className="text-sm text-fg-muted hover:text-fg"
      >
        ← กลับหน้าเข้าสู่ระบบ / Back to login
      </button>
    </div>
  );
}

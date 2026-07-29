'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOtpVerify, useOtpRequest } from '@/lib/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { messageForError } from '@/lib/error';

/**
 * OTP entry content (Design M8). Receives `challengeId` and `phone` via query
 * params from the login page. Shows individual OTP digit cells (otpcells
 * design), countdown timer for resend, and error handling.
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

  const handleComplete = async (otpCode: string) => {
    setError(null);
    try {
      await otpVerify.mutateAsync({
        challengeId: currentChallengeId,
        code: otpCode,
      });
      router.replace('/account');
    } catch (err) {
      setError(messageForError(err));
      setCode('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) {
      setError('กรุณากรอกรหัส OTP / Please enter the full OTP code.');
      return;
    }
    await handleComplete(code);
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
    } catch (err) {
      setError(messageForError(err));
    }
  };

  if (!challengeId || !phone) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-disp text-xl font-semibold text-fg">
          กรอกรหัส OTP / Enter OTP
        </h1>
        <p className="text-sm text-fg-muted">
          ส่งรหัสไปที่ {phone}
        </p>
      </div>

      {/* Dev code hint (only in dev mode) */}
      {devCode && (
        <div className="rounded-card border border-status-info/20 bg-status-info/5 px-3 py-2 text-center">
          <p className="font-score text-sm text-status-info">
            [DEV] OTP code: {devCode}
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2 text-center">
          <p className="text-sm text-status-danger">{error}</p>
        </div>
      )}

      {/* OTP Cells (Design otpcells/otpc) */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <OtpInput
          length={6}
          error={!!error}
          disabled={otpVerify.isPending}
          onChange={setCode}
          onComplete={handleComplete}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={otpVerify.isPending || code.length < 6}
        >
          {otpVerify.isPending ? 'กำลังยืนยัน...' : 'ยืนยัน / Verify'}
        </Button>
      </form>

      {/* Resend */}
      <div className="flex items-center justify-center">
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOtpRequest, useLineLoginUrl } from '@/lib/hooks/use-auth';
import { useMe } from '@/lib/auth/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { messageForError } from '@/lib/error';

type Tab = 'phone' | 'line';

/**
 * Member login — LINE + phone OTP tabs (Design M7a).
 * If already logged in, redirects to /account.
 */
export default function LoginPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const [tab, setTab] = useState<Tab>('phone');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const otpRequest = useOtpRequest();
  const lineLogin = useLineLoginUrl();

  // Already logged in — redirect
  if (me) {
    router.replace('/account');
    return null;
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Thai phone format: 0x-xxxx-xxxx (10 digits starting with 0)
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10 || !cleaned.startsWith('0')) {
      setError('กรุณากรอกเบอร์โทรศัพท์ 10 หลัก / Please enter a valid 10-digit phone number.');
      return;
    }

    try {
      const result = await otpRequest.mutateAsync({
        phone: cleaned,
        purpose: 'LOGIN',
      });
      // Navigate to OTP entry with challengeId + phone in query params
      const params = new URLSearchParams({
        challengeId: result.challengeId,
        phone: cleaned,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      });
      router.push(`/login/otp?${params.toString()}`);
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleLineLogin = async () => {
    setError(null);
    try {
      const result = await lineLogin.mutateAsync();
      // Redirect to LINE's authorization URL
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-disp text-xl font-semibold text-fg">เข้าสู่ระบบ / Login</h1>
        <p className="text-sm text-fg-muted">
          เลือกวิธีเข้าสู่ระบบ / Choose your login method.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-card bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setTab('phone')}
          className={cn(
            'flex-1 rounded-card px-3 py-2 text-sm font-medium transition-colors',
            tab === 'phone'
              ? 'bg-surface text-fg shadow-sm'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          เบอร์โทร / Phone
        </button>
        <button
          type="button"
          onClick={() => setTab('line')}
          className={cn(
            'flex-1 rounded-card px-3 py-2 text-sm font-medium transition-colors',
            tab === 'line'
              ? 'bg-surface text-fg shadow-sm'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          LINE
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-sm text-status-danger">{error}</p>
        </div>
      )}

      {/* Phone OTP tab */}
      {tab === 'phone' && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="phone" className="text-sm font-medium text-fg">
                  เบอร์โทรศัพท์ / Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="0812345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-card border border-line-300 bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  maxLength={12}
                  autoComplete="tel"
                />
                <p className="text-xs text-fg-muted">
                  เราจะส่ง OTP ไปยังเบอร์นี้ / We&apos;ll send an OTP to this number.
                </p>
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={otpRequest.isPending}
              >
                {otpRequest.isPending ? 'กำลังส่ง...' : 'ขอรหัส OTP / Request OTP'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* LINE tab */}
      {tab === 'line' && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <p className="text-sm text-fg-muted">
              เข้าสู่ระบบด้วยบัญชี LINE ของคุณ / Sign in with your LINE account.
            </p>
            <Button
              variant="line"
              className="w-full"
              onClick={handleLineLogin}
              disabled={lineLogin.isPending}
            >
              {lineLogin.isPending ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย LINE / Login with LINE'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

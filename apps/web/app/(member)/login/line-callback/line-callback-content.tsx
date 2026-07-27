'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLineCallback } from '@/lib/hooks/use-auth';
import { messageForError } from '@/lib/error';

/**
 * LINE OAuth callback handler. LINE redirects here with `?code=...&state=...`
 * after the user authorizes. Exchanges the code for a member session via
 * `POST /auth/line/callback`, then redirects to /account on success.
 */
export function LineCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lineCallback = useLineCallback();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const code = searchParams.get('code') ?? '';
  const state = searchParams.get('state') ?? '';

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!code || !state) {
      setError('ข้อมูลไม่ครบ กรุณาลองใหม่ / Missing callback parameters. Please try again.');
      return;
    }

    lineCallback
      .mutateAsync({ code, state })
      .then(() => {
        router.replace('/account');
      })
      .catch((err) => {
        setError(messageForError(err));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-disp text-lg font-semibold text-fg">
          เข้าสู่ระบบไม่สำเร็จ / Login failed
        </h1>
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-sm text-status-danger">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="text-sm text-accent hover:underline"
        >
          ← กลับหน้าเข้าสู่ระบบ / Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 pt-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <p className="text-sm text-fg-muted">
        กำลังเข้าสู่ระบบ... / Signing in...
      </p>
    </div>
  );
}

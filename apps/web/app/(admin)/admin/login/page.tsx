'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminLogin } from '@/lib/hooks/use-admin-auth';
import { useAdminMe } from '@/lib/auth/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { messageForError } from '@/lib/error';

/**
 * Admin login page — email + password (ADR-0005).
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const { data: admin } = useAdminMe();
  const adminLogin = useAdminLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Already logged in — redirect
  if (admin) {
    router.replace('/admin');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน / Please enter email and password.');
      return;
    }

    try {
      await adminLogin.mutateAsync({ email: email.trim(), password });
      router.replace('/admin');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-disp text-xl font-semibold text-fg">court2go Admin</h1>
          <p className="mt-1 text-sm text-fg-muted">เข้าสู่ระบบผู้ดูแล / Admin login</p>
        </div>

        {error && (
          <div className="mb-4 rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
            <p className="text-sm text-status-danger">{error}</p>
          </div>
        )}

        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-email" className="text-sm font-medium text-fg">
                  อีเมล / Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  className="rounded-card border border-line-300 bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-password" className="text-sm font-medium text-fg">
                  รหัสผ่าน / Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="rounded-card border border-line-300 bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={adminLogin.isPending}
              >
                {adminLogin.isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ / Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

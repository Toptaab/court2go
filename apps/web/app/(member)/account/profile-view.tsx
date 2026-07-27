'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Me } from '@repo/types';
import { useMe } from '@/lib/auth/hooks';
import { useLogout } from '@/lib/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface ProfileViewProps {
  initialMe: Me;
}

/**
 * Profile view (Design M19) — shows member info with edit link and logout.
 * Uses `useMe` for live data (refreshes after edits), falling back to the
 * SSR-fetched `initialMe` on first render.
 */
export function ProfileView({ initialMe }: ProfileViewProps) {
  const router = useRouter();
  const { data: me } = useMe();
  const logout = useLogout();
  const [loggingOut, setLoggingOut] = useState(false);

  // Use live data if available, otherwise SSR data
  const profile = me ?? initialMe;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout.mutateAsync();
      router.replace('/');
    } catch {
      setLoggingOut(false);
    }
  };

  const sexLabel: Record<string, string> = {
    MALE: 'ชาย / Male',
    FEMALE: 'หญิง / Female',
    OTHER: 'อื่น ๆ / Other',
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Avatar + name header (Design M19) */}
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-2xl font-bold text-accent">
          {profile.name ? profile.name.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-fg">{profile.name ?? 'Member'}</p>
          <p className="font-score text-xs text-ink-500">{profile.phone ?? ''}</p>
        </div>
        <Link href="/account/edit">
          <Button variant="outline" size="sm">
            Edit profile
          </Button>
        </Link>
      </div>

      {/* LINE Bind card (Design M19 .linebind) */}
      <div className="flex items-center gap-3 rounded-lg border border-line-100 bg-surface p-3.5">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-status-line">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 5.83 2 10.5c0 3.87 3.33 7.11 7.83 7.94.3.07.72.2.83.47.1.24.06.62.03.86l-.13.8c-.04.24-.19.94.82.51 1.01-.42 5.46-3.21 7.44-5.5C20.81 13.36 22 11.99 22 10.5 22 5.83 17.52 2 12 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <b className="text-sm text-fg">
            {profile.lineBound ? 'LINE Connected' : 'Connect LINE'}
          </b>
          <p className="text-[11.5px] text-ink-500">
            {profile.lineBound
              ? 'Notifications active — booking updates via LINE'
              : 'Get booking reminders and updates via LINE'}
          </p>
        </div>
        {!profile.lineBound && (
          <Button variant="line" size="sm" className="flex-none">
            Bind
          </Button>
        )}
        {profile.lineBound && (
          <Badge variant="ok">ON</Badge>
        )}
      </div>

      {/* Personal info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Personal info</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Phone */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-fg-muted">Phone</p>
              <p className="font-score text-sm text-fg">
                {profile.phone ?? '—'}
              </p>
            </div>
            {profile.phoneVerified && (
              <Badge variant="ok">Verified</Badge>
            )}
            {profile.phone && !profile.phoneVerified && (
              <Badge variant="warn">Unverified</Badge>
            )}
          </div>

          {/* Name */}
          <div>
            <p className="text-xs text-fg-muted">Name</p>
            <p className="text-sm text-fg">{profile.name ?? '—'}</p>
          </div>

          {/* Sex */}
          <div>
            <p className="text-xs text-fg-muted">Sex</p>
            <p className="text-sm text-fg">
              {profile.sex ? sexLabel[profile.sex] ?? profile.sex : '—'}
            </p>
          </div>

          {/* Emergency contact */}
          <div>
            <p className="text-xs text-fg-muted">Emergency contact</p>
            <p className="text-sm text-fg">
              {profile.emergencyContact ?? '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? 'Logging out...' : 'Logout'}
      </Button>
    </div>
  );
}

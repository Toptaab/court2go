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
      <div className="flex items-center justify-between">
        <h1 className="font-disp text-xl font-semibold text-fg">
          โปรไฟล์ / Profile
        </h1>
        <Link href="/account/edit">
          <Button variant="outline" size="sm">
            แก้ไข / Edit
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ข้อมูลส่วนตัว / Personal info</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Phone */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-fg-muted">เบอร์โทร / Phone</p>
              <p className="font-score text-sm text-fg">
                {profile.phone ?? '—'}
              </p>
            </div>
            {profile.phoneVerified && (
              <Badge variant="ok">ยืนยันแล้ว</Badge>
            )}
            {profile.phone && !profile.phoneVerified && (
              <Badge variant="warn">ยังไม่ยืนยัน</Badge>
            )}
          </div>

          {/* Name */}
          <div>
            <p className="text-xs text-fg-muted">ชื่อ / Name</p>
            <p className="text-sm text-fg">{profile.name ?? '—'}</p>
          </div>

          {/* Sex */}
          <div>
            <p className="text-xs text-fg-muted">เพศ / Sex</p>
            <p className="text-sm text-fg">
              {profile.sex ? sexLabel[profile.sex] ?? profile.sex : '—'}
            </p>
          </div>

          {/* Emergency contact */}
          <div>
            <p className="text-xs text-fg-muted">
              ผู้ติดต่อฉุกเฉิน / Emergency contact
            </p>
            <p className="text-sm text-fg">
              {profile.emergencyContact ?? '—'}
            </p>
          </div>

          {/* LINE status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-fg-muted">LINE</p>
              <p className="text-sm text-fg">
                {profile.hasLineLogin ? 'เชื่อมต่อแล้ว / Connected' : 'ยังไม่ได้เชื่อมต่อ / Not connected'}
              </p>
            </div>
            {profile.lineBound && (
              <Badge variant="ok">แจ้งเตือน ON</Badge>
            )}
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
        {loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ / Logout'}
      </Button>
    </div>
  );
}

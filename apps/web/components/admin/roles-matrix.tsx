'use client';

import { useRolesMatrix } from '@/lib/hooks/use-admin-users';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Human-friendly copy for each capability key (Design D16, PRD A9). Server
 * `label` stays the terse source of truth; this map only affects display.
 */
const CAPABILITY_COPY: Record<string, { th: string; en: string; hint: string }> = {
  view_all_branches: {
    th: 'ดูข้อมูลทุกสาขา',
    en: 'View all branches',
    hint: 'See bookings, courts, and stats across every branch, not just one.',
  },
  manage_branches: {
    th: 'สร้าง/แก้ไขสาขา',
    en: 'Add or edit branches',
    hint: 'Open new branches or change branch details like address and hours.',
  },
  manage_sports: {
    th: 'สร้าง/แก้ไขกีฬา',
    en: 'Add or edit sports',
    hint: 'Add sports types or change how existing ones are set up.',
  },
  manage_courts: {
    th: 'สร้าง/แก้ไขสนาม',
    en: 'Add or edit courts',
    hint: 'Add courts, change pricing, or update open/close hours.',
  },
  manage_bookings: {
    th: 'จัดการการจอง',
    en: 'Manage bookings',
    hint: 'Create, change, or cancel bookings on behalf of members.',
  },
  review_payments: {
    th: 'ยืนยัน/ปฏิเสธการชำระเงิน',
    en: 'Confirm or reject payments',
    hint: 'Review payment slips and approve or reject them.',
  },
  manage_members: {
    th: 'ดู/บล็อกสมาชิก',
    en: 'View or block members',
    hint: 'Look up member accounts and block ones causing trouble.',
  },
  manage_promotions: {
    th: 'สร้าง/แก้ไขโปรโมชั่น',
    en: 'Add or edit promotions',
    hint: 'Set up discount codes and promotional offers.',
  },
  manage_news: {
    th: 'สร้าง/แก้ไขข่าวสาร',
    en: 'Add or edit news',
    hint: 'Post announcements and updates shown to members.',
  },
  manage_config: {
    th: 'แก้ไขการตั้งค่า/แบรนด์',
    en: 'Edit config & branding',
    hint: 'Change tenant-wide settings, logo, and brand colors.',
  },
  manage_admin_users: {
    th: 'จัดการผู้ดูแลระบบ',
    en: 'Manage admin users',
    hint: 'Add, edit, deactivate, or remove admin accounts.',
  },
};

/**
 * Roles capability matrix (Design D16, PRD A9) — a purely presentational
 * mirror of server-side RBAC (`GET /admin/roles-matrix`); the server is the
 * real enforcement, this is documentation for admins. Embedded in the admin
 * users screen rather than living on its own page/nav entry.
 */
export function RolesMatrix() {
  const { data, isLoading, isError } = useRolesMatrix();

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">สิทธิ์การใช้งาน / Roles &amp; capabilities</h2>
          <p className="text-xs text-fg-muted">
            แต่ละบทบาททำอะไรได้บ้าง / What each role can do (server-enforced).
          </p>
        </div>

        {isLoading && <div className="h-64 animate-pulse rounded-card bg-surface-2" />}
        {isError && (
          <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load the roles matrix.</p>
        )}

        {data && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-line-100">
                  <th className="p-1.5 text-left font-medium text-fg-muted">สิ่งที่ทำได้ / What they can do</th>
                  {data.roles.map((role) => (
                    <th key={role} className="p-1.5 text-center font-medium text-fg-muted">{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.capabilities.map((cap) => {
                  const copy = CAPABILITY_COPY[cap.key];
                  return (
                    <tr
                      key={cap.key}
                      className="border-b border-line-100 last:border-0"
                      title={copy?.hint ?? cap.label}
                    >
                      <td className="p-1.5 text-fg">
                        <span className="font-medium">{copy ? copy.en : cap.label}</span>
                        {copy && <span className="text-fg-muted"> · {copy.th}</span>}
                      </td>
                      {data.roles.map((role) => (
                        <td key={role} className="p-1.5 text-center">
                          {cap.allowed[role] ? (
                            <span className="text-status-ok">✓</span>
                          ) : (
                            <span className="text-fg-muted">✗</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

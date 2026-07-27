'use client';

import { useRolesMatrix } from '@/lib/hooks/use-admin-users';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Roles capability matrix (Design D16, PRD A9) — a purely presentational
 * mirror of server-side RBAC (`GET /admin/roles-matrix`); the server is the
 * real enforcement, this is documentation for admins.
 */
export default function RolesMatrixPage() {
  const { data, isLoading, isError } = useRolesMatrix();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">สิทธิ์การใช้งาน / Roles &amp; capabilities</h1>
        <p className="text-xs text-fg-muted">
          ตารางแสดงสิทธิ์ของแต่ละบทบาท / What each role can do (server-enforced).
        </p>
      </div>

      {isLoading && <div className="h-64 animate-pulse rounded-card bg-surface-2" />}
      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load the roles matrix.</p>
      )}

      {data && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-100">
                  <th className="p-3 text-left font-medium text-fg-muted">ความสามารถ / Capability</th>
                  {data.roles.map((role) => (
                    <th key={role} className="p-3 text-center font-medium text-fg-muted">{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.capabilities.map((cap) => (
                  <tr key={cap.key} className="border-b border-line-100 last:border-0">
                    <td className="p-3 text-fg">{cap.label}</td>
                    {data.roles.map((role) => (
                      <td key={role} className="p-3 text-center">
                        {cap.allowed[role] ? (
                          <span className="text-status-ok">✓</span>
                        ) : (
                          <span className="text-fg-muted">✗</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

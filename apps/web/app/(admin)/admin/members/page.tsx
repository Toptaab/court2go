'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdminMembers } from '@/lib/hooks/use-admin-members';
import { formatIctDateTime } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/** Member list (Design D12, PRD A7) — searchable by phone/name, paginated. */
export default function AdminMembersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, isLoading, isError } = useAdminMembers({ page, q: q || undefined });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">สมาชิก / Members</h1>
        <p className="text-xs text-fg-muted">รายชื่อสมาชิกทั้งหมด / All registered members.</p>
      </div>

      <Input
        type="text"
        placeholder="ค้นหาเบอร์โทรหรือชื่อ / Search phone or name"
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1); }}
        className="max-w-sm"
      />

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load members.</p>
      )}

      {data && data.items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">ไม่พบสมาชิก / No members found.</p>
      )}

      {data?.items.map((member) => (
        <Link key={member.id} href={`/admin/members/${member.id}`}>
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-fg">{member.name ?? member.phone ?? '—'}</span>
                  {member.isBlocked && <Badge variant="danger">ระงับ / Blocked</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-fg-muted">{member.phone ?? 'ไม่มีเบอร์ / No phone'}</p>
              </div>
              <div className="text-right">
                <p className="font-score text-xs text-fg">{member.bookingCount} การจอง / bookings</p>
                {member.lastBookingAt && (
                  <p className="font-score text-xs text-fg-muted">{formatIctDateTime(member.lastBookingAt)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}

      {data && (data.hasNextPage || page > 1) && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า / Prev
          </Button>
          <span className="font-score text-xs text-fg-muted">
            {page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
          </span>
          <Button variant="outline" size="sm" disabled={!data.hasNextPage} onClick={() => setPage((p) => p + 1)}>
            ถัดไป / Next
          </Button>
        </div>
      )}
    </div>
  );
}

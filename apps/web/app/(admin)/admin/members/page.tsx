'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MemberAdminView } from '@repo/types';
import { useAdminMembers } from '@/lib/hooks/use-admin-members';
import { formatIctDateTime } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PaginatedTable, type DataTableColumn } from '@/components/ui/paginated-list';

/** Member list (Design D12, PRD A7) — searchable by phone/name, paginated. */
export default function AdminMembersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, isLoading, isError } = useAdminMembers({ page, q: q || undefined });

  const columns: DataTableColumn<MemberAdminView>[] = [
    {
      header: 'Member',
      cell: (member) => (
        <>
          <div className="flex items-center gap-2">
            <span className="font-medium text-fg">{member.name ?? member.phone ?? '—'}</span>
            {member.isBlocked && <Badge variant="danger">ระงับ / Blocked</Badge>}
          </div>
          <div className="font-mono text-xs text-fg-muted">{member.phone ?? 'ไม่มีเบอร์ / No phone'}</div>
        </>
      ),
    },
    {
      header: 'Bookings',
      cell: (member) => <span className="font-score text-xs text-fg">{member.bookingCount}</span>,
    },
    {
      header: 'Last booking',
      cell: (member) => (
        <span className="font-score text-xs text-fg-muted">
          {member.lastBookingAt ? formatIctDateTime(member.lastBookingAt) : '—'}
        </span>
      ),
    },
  ];

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

      <PaginatedTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        page={page}
        onPageChange={setPage}
        columns={columns}
        keyOf={(member) => member.id}
        onRowClick={(member) => router.push(`/admin/members/${member.id}`)}
        emptyMessage="ไม่พบสมาชิก / No members found."
        errorMessage="เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load members."
      />
    </div>
  );
}

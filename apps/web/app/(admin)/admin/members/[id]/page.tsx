'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAdminMember, useAdminMemberBookings, useBlockMember } from '@/lib/hooks/use-admin-members';
import { messageForError } from '@/lib/error';
import { formatIctDate, formatIctTime, formatIctDateTime, formatTHB } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, BookingStatusBadge } from '@/components/ui/badge';

/** Member detail (Design D12, PRD A7) — aggregates, block/unblock, booking history. */
export default function AdminMemberDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: member, isLoading, isError } = useAdminMember(params.id);

  const [page, setPage] = useState(1);
  const { data: bookings } = useAdminMemberBookings(params.id, page);

  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const blockMember = useBlockMember(params.id);

  const handleToggleBlock = async () => {
    setError(null);
    try {
      await blockMember.mutateAsync({ blocked: !member?.isBlocked, reason: reason.trim() || undefined });
      setReason('');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-card bg-surface-2" />;
  if (isError || !member) {
    return (
      <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load this member.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-fg">{member.name ?? member.phone ?? 'สมาชิก / Member'}</h1>
        {member.isBlocked && <Badge variant="danger">ระงับ / Blocked</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ข้อมูลสมาชิก / Member details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <p><span className="text-fg-muted">เบอร์โทร / Phone: </span>{member.phone ?? '—'}</p>
          <p><span className="text-fg-muted">ยืนยันแล้ว / Phone verified: </span>{member.phoneVerified ? 'ใช่ / Yes' : 'ไม่ / No'}</p>
          <p><span className="text-fg-muted">LINE: </span>{member.lineBound ? 'ผูกบัญชีแล้ว / Bound' : 'ยังไม่ผูก / Not bound'}</p>
          <p><span className="text-fg-muted">จำนวนการจอง / Bookings: </span>{member.bookingCount}</p>
          <p className="font-score">
            <span className="text-fg-muted">การจองล่าสุด / Last booking: </span>
            {member.lastBookingAt ? formatIctDateTime(member.lastBookingAt) : '—'}
          </p>
          <p className="font-score">
            <span className="text-fg-muted">สมัครเมื่อ / Member since: </span>
            {formatIctDateTime(member.createdAt)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ระงับการใช้งาน / Block / unblock</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!member.isBlocked && (
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เหตุผล (ไม่บังคับ) / Reason (optional)"
              className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          )}
          {error && <p className="text-xs text-status-danger">{error}</p>}
          <Button
            type="button"
            variant={member.isBlocked ? 'secondary' : 'destructive'}
            size="sm"
            className="self-start"
            disabled={blockMember.isPending}
            onClick={handleToggleBlock}
          >
            {blockMember.isPending
              ? 'กำลังบันทึก...'
              : member.isBlocked
                ? 'ยกเลิกการระงับ / Unblock'
                : 'ระงับการใช้งาน / Block'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ประวัติการจอง / Booking history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {bookings && bookings.items.length === 0 && (
            <p className="text-xs text-fg-muted">ยังไม่มีการจอง / No bookings yet.</p>
          )}
          {bookings?.items.map((b) => (
            <Link key={b.id} href={`/admin/bookings/${b.id}`}>
              <div className="flex items-center justify-between gap-3 rounded-card bg-surface-2 px-3 py-2 hover:bg-line-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-fg">{b.courtName}</span>
                    <BookingStatusBadge status={b.status} />
                  </div>
                  <p className="font-score text-xs text-fg-muted">
                    {formatIctDate(b.startsAt)} · {formatIctTime(b.startsAt)}–{formatIctTime(b.endsAt)}
                  </p>
                </div>
                <p className="font-score text-xs font-semibold text-accent">{formatTHB(b.amountDue)}</p>
              </div>
            </Link>
          ))}
          {bookings && (bookings.hasNextPage || page > 1) && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ก่อนหน้า / Prev
              </Button>
              <span className="font-score text-xs text-fg-muted">
                {page} / {Math.max(1, Math.ceil(bookings.total / bookings.pageSize))}
              </span>
              <Button variant="outline" size="sm" disabled={!bookings.hasNextPage} onClick={() => setPage((p) => p + 1)}>
                ถัดไป / Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

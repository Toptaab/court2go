'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAdminBookingDetail } from '@/lib/hooks/use-admin-bookings';
import { formatTHB, formatIctDate, formatIctTime, formatIctDateTime } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/ui/badge';

/**
 * Admin booking detail (Design D2 detail). Shows full booking info + payment
 * + member info. Action buttons (confirm/reject/cancel/outcome) land in M10.8.
 */
export default function AdminBookingDetailPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const { data: booking, isLoading, isError } = useAdminBookingDetail(params.bookingId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-6 w-1/2 animate-pulse rounded bg-surface-2" />
        <div className="h-48 animate-pulse rounded-card bg-surface-2" />
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">ไม่พบการจอง / Booking not found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/admin/bookings')}>
          ← กลับ / Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => router.push('/admin/bookings')}
        className="self-start text-sm text-accent hover:underline"
      >
        ← รายการจอง / Booking list
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-fg">รายละเอียดการจอง / Booking Detail</h1>
        <BookingStatusBadge status={booking.status} />
      </div>

      {/* Booking info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{booking.context.courtName}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-fg-muted">สาขา / Branch</p>
            <p className="text-fg">{booking.context.branchName}</p>
          </div>
          <div>
            <p className="text-xs text-fg-muted">กีฬา / Sport</p>
            <p className="text-fg">{booking.context.sportName}</p>
          </div>
          <div>
            <p className="text-xs text-fg-muted">วันที่ / Date</p>
            <p className="font-score text-fg">{formatIctDate(booking.startsAt)}</p>
          </div>
          <div>
            <p className="text-xs text-fg-muted">เวลา / Time</p>
            <p className="font-score text-fg">
              {formatIctTime(booking.startsAt)} – {formatIctTime(booking.endsAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-fg-muted">จำนวน / Slots</p>
            <p className="font-score text-fg">{booking.slotCount}</p>
          </div>
          <div>
            <p className="text-xs text-fg-muted">สร้างเมื่อ / Created</p>
            <p className="font-score text-xs text-fg">{formatIctDateTime(booking.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Member info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">สมาชิก / Member</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p className="text-fg">{booking.member.name ?? '—'}</p>
          <p className="font-score text-fg-muted">{booking.member.phone ?? '—'}</p>
          <p className="text-xs text-fg-muted">
            {booking.member.phoneVerified ? 'ยืนยันเบอร์แล้ว' : 'ยังไม่ยืนยันเบอร์'}
            {booking.isWalkIn && ' · Walk-in'}
          </p>
        </CardContent>
      </Card>

      {/* Payment info */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">การชำระเงิน / Payment</CardTitle>
            <PaymentStatusBadge status={booking.payment.status} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-fg-muted">ยอดชำระ / Amount</span>
            <span className="font-score text-lg font-semibold text-accent">
              {formatTHB(booking.price.total)}
            </span>
          </div>
          {booking.price.promotion && (
            <div className="flex justify-between text-xs">
              <span className="text-status-ok">Promo: {booking.price.promotion.code}</span>
              <span className="font-score text-status-ok">
                −{formatTHB(booking.price.promotion.discountAmount)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions placeholder — M10.8 adds confirm/reject/cancel/outcome buttons here */}
      <div className="rounded-card border border-line-100 bg-surface-2 p-4 text-center text-xs text-fg-muted">
        การดำเนินการ (confirm, reject, cancel, outcome) จะเพิ่มใน M10.8 /
        Actions coming in M10.8.
      </div>
    </div>
  );
}

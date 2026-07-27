'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAdminPromotionUsage } from '@/lib/hooks/use-admin-promotions';
import { formatIctDateTime, formatTHB } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** Promotion redemption-usage view (Design D11, PRD A6.1 AC4). Paginated. */
export default function PromotionUsagePage() {
  const params = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminPromotionUsage(params.id, page);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">ประวัติการใช้โปรโมชั่น / Promotion usage</h1>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load usage.</p>
      )}

      {data && data.items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">ยังไม่มีการใช้งาน / No redemptions yet.</p>
      )}

      {data?.items.map((item) => (
        <Card key={item.bookingId}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm text-fg">{item.memberPhone ?? '—'}</p>
              <p className="font-score text-xs text-fg-muted">{formatIctDateTime(item.usedAt)}</p>
            </div>
            <p className="font-score text-sm font-semibold text-accent">-{formatTHB(item.discountAmount)}</p>
          </CardContent>
        </Card>
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

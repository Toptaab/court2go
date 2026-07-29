'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAdminPromotionUsage } from '@/lib/hooks/use-admin-promotions';
import { formatIctDateTime, formatTHB } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { PaginatedList } from '@/components/ui/paginated-list';

/** Promotion redemption-usage view (Design D11, PRD A6.1 AC4). Paginated. */
export default function PromotionUsagePage() {
  const params = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminPromotionUsage(params.id, page);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">ประวัติการใช้โปรโมชั่น / Promotion usage</h1>

      <PaginatedList
        data={data}
        isLoading={isLoading}
        isError={isError}
        page={page}
        onPageChange={setPage}
        keyOf={(item) => item.bookingId}
        emptyMessage="ยังไม่มีการใช้งาน / No redemptions yet."
        errorMessage="เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load usage."
        skeletonCount={3}
        skeletonClassName="h-14"
        renderItem={(item) => (
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-fg">{item.memberPhone ?? '—'}</p>
                <p className="font-score text-xs text-fg-muted">{formatIctDateTime(item.usedAt)}</p>
              </div>
              <p className="font-score text-sm font-semibold text-accent">-{formatTHB(item.discountAmount)}</p>
            </CardContent>
          </Card>
        )}
      />
    </div>
  );
}

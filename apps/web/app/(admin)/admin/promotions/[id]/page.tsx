'use client';

import { useParams } from 'next/navigation';
import { useAdminPromotions } from '@/lib/hooks/use-admin-promotions';
import { PromotionForm } from '@/components/admin/promotion-form';

/**
 * Edit-Promotion screen (Design D11, PRD A6.1). There is no single-Promotion
 * GET endpoint (see `use-admin-promotions.ts`) — the initial value is found
 * from the already-fetched `GET /admin/promotions` list, same pattern as the
 * Sport editor (`use-admin-catalog.ts`).
 */
export default function EditPromotionPage() {
  const params = useParams<{ id: string }>();
  const { data: promotions, isLoading, isError } = useAdminPromotions();
  const promotion = promotions?.find((p) => p.id === params.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">แก้ไขโปรโมชั่น / Edit promotion</h1>

      {isLoading && <div className="h-64 animate-pulse rounded-card bg-surface-2" />}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load this promotion.</p>
      )}

      {!isLoading && !isError && !promotion && (
        <p className="text-sm text-status-danger">ไม่พบโปรโมชั่นนี้ / This promotion could not be found.</p>
      )}

      {promotion && <PromotionForm initial={promotion} />}
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Promotion } from '@repo/types';
import { useAdminPromotions, useDeactivatePromotion, useDeletePromotion } from '@/lib/hooks/use-admin-promotions';
import { messageForError } from '@/lib/error';
import { formatIctDateTime, formatTHB } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SimpleTable, type DataTableColumn } from '@/components/ui/paginated-list';

/**
 * Promotion list (Design D11, PRD A6.1) — create/edit/deactivate/soft-delete,
 * plus a link into each Promotion's redemption-usage view.
 */
export default function AdminPromotionsPage() {
  const router = useRouter();
  const { data: promotions, isLoading, isError } = useAdminPromotions();

  const discountLabel = (promotion: Promotion) =>
    promotion.discountType === 'PERCENTAGE' ? `${promotion.discountValue}%` : formatTHB(promotion.discountValue);

  const columns: DataTableColumn<Promotion>[] = [
    {
      header: 'Code',
      cell: (promotion) => (
        <>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-fg">{promotion.code}</span>
            {!promotion.isActive && <Badge variant="neutral">ปิดใช้งาน / Inactive</Badge>}
          </div>
          {promotion.description && <div className="mt-0.5 text-xs text-fg-muted">{promotion.description}</div>}
        </>
      ),
    },
    { header: 'Discount', cell: (promotion) => <Badge variant="accent">{discountLabel(promotion)}</Badge> },
    {
      header: 'Valid',
      cell: (promotion) => (
        <span className="font-score text-xs text-fg-muted">
          {formatIctDateTime(promotion.validFrom)} – {formatIctDateTime(promotion.validUntil)}
        </span>
      ),
    },
    {
      header: 'Used',
      cell: (promotion) => (
        <span className="font-score text-xs text-fg-muted">
          {promotion.totalUses}{promotion.maxTotalUses ? ` / ${promotion.maxTotalUses}` : ''}
        </span>
      ),
    },
    { header: 'Actions', cell: (promotion) => <PromotionActions promotion={promotion} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg">โปรโมชั่น / Promotions</h1>
          <p className="text-xs text-fg-muted">จัดการโค้ดส่วนลด / Manage discount codes.</p>
        </div>
        <Link href="/admin/promotions/new">
          <Button variant="primary" size="sm">+ โปรโมชั่นใหม่ / New promotion</Button>
        </Link>
      </div>

      <SimpleTable
        items={promotions}
        isLoading={isLoading}
        isError={isError}
        columns={columns}
        keyOf={(promotion) => promotion.id}
        onRowClick={(promotion) => router.push(`/admin/promotions/${promotion.id}`)}
        emptyMessage="ยังไม่มีโปรโมชั่น / No promotions yet."
        errorMessage="เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load promotions."
        skeletonCount={3}
        skeletonClassName="h-16"
        minWidth="min-w-[760px]"
      />
    </div>
  );
}

function PromotionActions({ promotion }: { promotion: Promotion }) {
  const [error, setError] = useState<string | null>(null);
  const deactivate = useDeactivatePromotion(promotion.id);
  const softDelete = useDeletePromotion(promotion.id);

  const handleDeactivate = async () => {
    setError(null);
    try {
      await deactivate.mutateAsync();
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleSoftDelete = async () => {
    setError(null);
    try {
      await softDelete.mutateAsync();
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/promotions/${promotion.id}/usage`}>
          <Button variant="outline" size="sm">ประวัติการใช้ / Usage</Button>
        </Link>
        {promotion.isActive && (
          <Button variant="secondary" size="sm" disabled={deactivate.isPending} onClick={handleDeactivate}>
            {deactivate.isPending ? 'กำลังปิดใช้งาน...' : 'ปิดใช้งาน / Deactivate'}
          </Button>
        )}
        <Button variant="destructive" size="sm" disabled={softDelete.isPending} onClick={handleSoftDelete}>
          {softDelete.isPending ? 'กำลังลบ...' : 'ลบ / Delete'}
        </Button>
      </div>
      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  );
}

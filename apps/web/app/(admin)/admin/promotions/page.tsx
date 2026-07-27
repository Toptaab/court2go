'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Promotion } from '@repo/types';
import { useAdminPromotions, useDeactivatePromotion, useDeletePromotion } from '@/lib/hooks/use-admin-promotions';
import { messageForError } from '@/lib/error';
import { formatIctDateTime, formatTHB } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Promotion list (Design D11, PRD A6.1) — create/edit/deactivate/soft-delete,
 * plus a link into each Promotion's redemption-usage view.
 */
export default function AdminPromotionsPage() {
  const { data: promotions, isLoading, isError } = useAdminPromotions();

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

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load promotions.</p>
      )}

      {promotions && promotions.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">ยังไม่มีโปรโมชั่น / No promotions yet.</p>
      )}

      {promotions?.map((promotion) => <PromotionRow key={promotion.id} promotion={promotion} />)}
    </div>
  );
}

function PromotionRow({ promotion }: { promotion: Promotion }) {
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

  const discountLabel =
    promotion.discountType === 'PERCENTAGE'
      ? `${promotion.discountValue}%`
      : formatTHB(promotion.discountValue);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/promotions/${promotion.id}`} className="text-sm font-semibold text-fg hover:underline">
                {promotion.code}
              </Link>
              {!promotion.isActive && <Badge variant="neutral">ปิดใช้งาน / Inactive</Badge>}
              <Badge variant="accent">{discountLabel}</Badge>
            </div>
            {promotion.description && <p className="mt-0.5 text-xs text-fg-muted">{promotion.description}</p>}
            <p className="mt-0.5 font-score text-xs text-fg-muted">
              {formatIctDateTime(promotion.validFrom)} – {formatIctDateTime(promotion.validUntil)}
            </p>
            <p className="mt-0.5 text-xs text-fg-muted">
              ใช้แล้ว {promotion.totalUses} ครั้ง
              {promotion.maxTotalUses ? ` / ${promotion.maxTotalUses}` : ''} · Used {promotion.totalUses}
              {promotion.maxTotalUses ? ` / ${promotion.maxTotalUses}` : ''} times
            </p>
          </div>
        </div>

        {error && <p className="text-xs text-status-danger">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/admin/promotions/${promotion.id}`}>
            <Button variant="outline" size="sm">แก้ไข / Edit</Button>
          </Link>
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
      </CardContent>
    </Card>
  );
}

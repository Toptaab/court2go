'use client';

import { useState } from 'react';
import { createCourtBlockBodySchema } from '@repo/types';
import { useAdminCourtBlocks, useCreateCourtBlock, useDeleteCourtBlock } from '@/lib/hooks/use-admin-catalog';
import { messageForError } from '@/lib/error';
import { formatIctDateTime } from '@/lib/format';
import { ictLocalToUtcIso } from '@/lib/ict-date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Court maintenance blocks (Design D7, PRD A5.1 AC5) — a date/time range the
 * court is unavailable without deactivating it entirely. Lives on the Court
 * edit page (`.../courts/[id]/page.tsx`) rather than a separate route.
 */
export function CourtBlocks({ courtId }: { courtId: string }) {
  const { data: blocks, isLoading, isError } = useAdminCourtBlocks(courtId);
  const createBlock = useCreateCourtBlock(courtId);
  const deleteBlock = useDeleteCourtBlock(courtId);

  const [reason, setReason] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!startsAt || !endsAt) {
      setError('กรุณาระบุช่วงเวลา / Please provide a start and end time.');
      return;
    }
    const draft: unknown = {
      reason: reason.trim() || undefined,
      startsAt: ictLocalToUtcIso(startsAt),
      endsAt: ictLocalToUtcIso(endsAt),
    };
    const parsed = createCourtBlockBodySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณาตรวจสอบข้อมูล / Please check the form.');
      return;
    }
    try {
      await createBlock.mutateAsync(parsed.data);
      setReason('');
      setStartsAt('');
      setEndsAt('');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleDelete = async (blockId: string) => {
    setError(null);
    try {
      await deleteBlock.mutateAsync(blockId);
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">ปิดปรับปรุงสนาม / Maintenance blocks</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-starts">เริ่ม / Starts at</Label>
            <Input
              id="block-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-ends">สิ้นสุด / Ends at</Label>
            <Input
              id="block-ends"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-reason">เหตุผล (ไม่บังคับ) / Reason (optional)</Label>
            <Input
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ซ่อมบำรุง / e.g. Maintenance"
            />
          </div>
        </div>

        {error && <p className="text-xs text-status-danger">{error}</p>}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={createBlock.isPending}
          onClick={handleCreate}
        >
          {createBlock.isPending ? 'กำลังเพิ่ม...' : '+ เพิ่มช่วงปิด / Add block'}
        </Button>

        <div className="flex flex-col gap-2 border-t border-line-100 pt-3">
          {isLoading && <div className="h-10 animate-pulse rounded-card bg-surface-2" />}
          {isError && (
            <p className="text-xs text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load blocks.</p>
          )}
          {blocks && blocks.length === 0 && (
            <p className="text-xs text-fg-muted">ไม่มีช่วงปิดปรับปรุง / No maintenance blocks.</p>
          )}
          {blocks?.map((block) => (
            <div key={block.id} className="flex items-center justify-between gap-2 rounded-card bg-surface-2 px-3 py-2">
              <div>
                <p className="font-score text-xs text-fg">
                  {formatIctDateTime(block.startsAt)} – {formatIctDateTime(block.endsAt)}
                </p>
                {block.reason && <p className="text-xs text-fg-muted">{block.reason}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={deleteBlock.isPending}
                onClick={() => handleDelete(block.id)}
              >
                ลบ / Remove
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

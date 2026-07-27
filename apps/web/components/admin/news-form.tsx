'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { upsertNewsBodySchema, type News, type UpsertNewsBody } from '@repo/types';
import { useCreateNews, useUpdateNews } from '@/lib/hooks/use-admin-news';
import { messageForError } from '@/lib/error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ImageUploadField } from '@/components/admin/image-upload-field';

interface NewsFormProps {
  /** Present when editing an existing News post; omitted for create. */
  initial?: News;
}

/** Shared News create/edit form (Design D13, PRD A10). */
export function NewsForm({ initial }: NewsFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [status, setStatus] = useState<UpsertNewsBody['status']>(initial?.status ?? 'DRAFT');
  const [error, setError] = useState<string | null>(null);

  const createNews = useCreateNews();
  const updateNews = useUpdateNews(initial?.id ?? '');
  const mutation = isEdit ? updateNews : createNews;

  const handleSubmit = async () => {
    setError(null);

    const draft: unknown = {
      title: title.trim(),
      body,
      imageUrl: imageUrl || null,
      status,
    };

    const parsed = upsertNewsBodySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณาตรวจสอบข้อมูล / Please check the form.');
      return;
    }

    try {
      await mutation.mutateAsync(parsed.data);
      router.push('/admin/news');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-sm text-status-danger">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ข้อมูลข่าวสาร / News details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="news-title">หัวข้อ / Title</Label>
            <Input id="news-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="news-body">เนื้อหา / Body</Label>
            <textarea
              id="news-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              maxLength={10000}
              className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <ImageUploadField purpose="NEWS" value={imageUrl} onUploaded={setImageUrl} label="รูปภาพ (ไม่บังคับ) / Image (optional)" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="news-status">สถานะ / Status</Label>
            <Select
              id="news-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as UpsertNewsBody['status'])}
            >
              <option value="DRAFT">แบบร่าง / Draft</option>
              <option value="PUBLISHED">เผยแพร่ / Published</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="button" variant="primary" disabled={mutation.isPending} onClick={handleSubmit}>
          {mutation.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก / Save' : 'สร้างข่าวสาร / Create news'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/news')}>
          ยกเลิก / Cancel
        </Button>
      </div>
    </div>
  );
}

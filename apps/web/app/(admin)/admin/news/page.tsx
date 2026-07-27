'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { News } from '@repo/types';
import { useAdminNews, useDeleteNews } from '@/lib/hooks/use-admin-news';
import { messageForError } from '@/lib/error';
import { formatIctDateTime } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/** News list (Design D13, PRD A10) — create/edit/delete announcements. */
export default function AdminNewsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminNews(page);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg">ข่าวสาร / News</h1>
          <p className="text-xs text-fg-muted">ประกาศสำหรับหน้าแรกสาธารณะ / Announcements for the public feed.</p>
        </div>
        <Link href="/admin/news/new">
          <Button variant="primary" size="sm">+ ข่าวใหม่ / New post</Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load news.</p>
      )}

      {data && data.items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">ยังไม่มีข่าวสาร / No news yet.</p>
      )}

      {data?.items.map((item) => <NewsRow key={item.id} item={item} />)}

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

function NewsRow({ item }: { item: News }) {
  const [error, setError] = useState<string | null>(null);
  const deleteNews = useDeleteNews(item.id);

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteNews.mutateAsync();
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/news/${item.id}`} className="text-sm font-semibold text-fg hover:underline">
                {item.title}
              </Link>
              <Badge variant={item.status === 'PUBLISHED' ? 'ok' : 'neutral'}>
                {item.status === 'PUBLISHED' ? 'เผยแพร่ / Published' : 'แบบร่าง / Draft'}
              </Badge>
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{item.body}</p>
            {item.publishedAt && (
              <p className="mt-0.5 font-score text-xs text-fg-muted">
                เผยแพร่เมื่อ {formatIctDateTime(item.publishedAt)}
              </p>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-status-danger">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/admin/news/${item.id}`}>
            <Button variant="outline" size="sm">แก้ไข / Edit</Button>
          </Link>
          <Button variant="destructive" size="sm" disabled={deleteNews.isPending} onClick={handleDelete}>
            {deleteNews.isPending ? 'กำลังลบ...' : 'ลบ / Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

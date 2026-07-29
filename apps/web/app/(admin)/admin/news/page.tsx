'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { News } from '@repo/types';
import { useAdminNews, useDeleteNews } from '@/lib/hooks/use-admin-news';
import { messageForError } from '@/lib/error';
import { formatIctDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaginatedTable, type DataTableColumn } from '@/components/ui/paginated-list';

/** News list (Design D13, PRD A10) — create/edit/delete announcements. */
export default function AdminNewsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminNews(page);

  const columns: DataTableColumn<News>[] = [
    {
      header: 'Title',
      cell: (item) => (
        <>
          <div className="flex items-center gap-2">
            <span className="font-medium text-fg">{item.title}</span>
            <Badge variant={item.status === 'PUBLISHED' ? 'ok' : 'neutral'}>
              {item.status === 'PUBLISHED' ? 'เผยแพร่ / Published' : 'แบบร่าง / Draft'}
            </Badge>
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{item.body}</div>
        </>
      ),
    },
    {
      header: 'Published',
      cell: (item) => (
        <span className="font-score text-xs text-fg-muted">
          {item.publishedAt ? formatIctDateTime(item.publishedAt) : '—'}
        </span>
      ),
    },
    { header: 'Actions', cell: (item) => <NewsActions item={item} /> },
  ];

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

      <PaginatedTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        page={page}
        onPageChange={setPage}
        columns={columns}
        keyOf={(item) => item.id}
        onRowClick={(item) => router.push(`/admin/news/${item.id}`)}
        emptyMessage="ยังไม่มีข่าวสาร / No news yet."
        errorMessage="เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load news."
        skeletonCount={3}
        skeletonClassName="h-20"
      />
    </div>
  );
}

function NewsActions({ item }: { item: News }) {
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
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <Button variant="destructive" size="sm" disabled={deleteNews.isPending} onClick={handleDelete}>
        {deleteNews.isPending ? 'กำลังลบ...' : 'ลบ / Delete'}
      </Button>
      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  );
}

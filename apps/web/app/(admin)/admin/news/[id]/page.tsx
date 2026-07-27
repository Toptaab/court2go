'use client';

import { useParams } from 'next/navigation';
import { useAdminNewsDetail } from '@/lib/hooks/use-admin-news';
import { NewsForm } from '@/components/admin/news-form';

/** Edit-News screen (Design D13, PRD A10). */
export default function EditNewsPage() {
  const params = useParams<{ id: string }>();
  const { data: news, isLoading, isError } = useAdminNewsDetail(params.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-fg">แก้ไขข่าวสาร / Edit news</h1>

      {isLoading && <div className="h-64 animate-pulse rounded-card bg-surface-2" />}

      {isError && (
        <p className="text-sm text-status-danger">ไม่พบข่าวสารนี้ / This news item could not be found.</p>
      )}

      {news && <NewsForm initial={news} />}
    </div>
  );
}

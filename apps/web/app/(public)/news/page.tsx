'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useNews } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatIctDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaginatedList } from '@/components/ui/paginated-list';

/**
 * News feed — public landing content (PRD C0, Design M1).
 * Paginated list of PUBLISHED announcements for the tenant.
 */
export default function NewsFeedPage() {
  const slug = getDevDefaultTenantSlug();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useNews(slug, page);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-disp text-lg font-semibold text-fg">ข่าวสาร / News</h1>

      <PaginatedList
        data={data}
        isLoading={isLoading}
        isError={isError}
        page={page}
        onPageChange={setPage}
        keyOf={(news) => news.id}
        emptyMessage="ไม่มีข่าวสาร / No news yet."
        errorMessage="ไม่สามารถโหลดข่าวสารได้ / Unable to load news."
        skeletonCount={3}
        skeletonClassName="h-24"
        renderItem={(news) => (
          <Link href={`/news/${news.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              {news.imageUrl && (
                <img
                  src={news.imageUrl}
                  alt={news.title}
                  className="h-40 w-full rounded-t-card object-cover"
                />
              )}
              <CardHeader>
                <CardTitle className="line-clamp-2">{news.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-2 text-sm text-fg-muted">{news.body}</p>
                <p className="mt-2 font-score text-xs text-ink-500">
                  {formatIctDate(news.publishedAt)}
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
      />
    </div>
  );
}

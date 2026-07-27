'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useNews } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatIctDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * News feed — public landing content (PRD C0, Design M1).
 * Paginated list of PUBLISHED announcements for the tenant.
 */
export default function NewsFeedPage() {
  const slug = getDevDefaultTenantSlug();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useNews(slug, page);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-disp text-lg font-semibold text-fg">ข่าวสาร / News</h1>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-card bg-surface-2" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-disp text-lg font-semibold text-fg">ข่าวสาร / News</h1>
        <p className="text-sm text-fg-muted">ไม่สามารถโหลดข่าวสารได้ / Unable to load news.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-disp text-lg font-semibold text-fg">ข่าวสาร / News</h1>

      {data.items.length === 0 && (
        <p className="text-sm text-fg-muted">ไม่มีข่าวสาร / No news yet.</p>
      )}

      {data.items.map((news) => (
        <Link key={news.id} href={`/news/${news.id}`}>
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
      ))}

      {/* Pagination controls */}
      {(data.hasNextPage || page > 1) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ก่อนหน้า / Previous
          </Button>
          <span className="font-score text-xs text-fg-muted">
            {page} / {Math.ceil(data.total / data.pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            ถัดไป / Next
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useNewsDetail } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatIctDate } from '@/lib/format';
import { Button } from '@/components/ui/button';

/**
 * News detail page — single published announcement (Design M1 detail view).
 */
export default function NewsDetailPage() {
  const params = useParams<{ newsId: string }>();
  const slug = getDevDefaultTenantSlug();
  const { data: news, isLoading, isError } = useNewsDetail(slug, params.newsId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-48 animate-pulse rounded-card bg-surface-2" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="h-32 animate-pulse rounded bg-surface-2" />
      </div>
    );
  }

  if (isError || !news) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">ไม่พบข่าวสาร / News not found.</p>
        <Link href="/news">
          <Button variant="outline" size="sm">← กลับ / Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/news" className="text-sm text-accent hover:underline">
        ← ข่าวสารทั้งหมด / All news
      </Link>

      {news.imageUrl && (
        <img
          src={news.imageUrl}
          alt={news.title}
          className="w-full rounded-card object-cover"
        />
      )}

      <h1 className="font-disp text-xl font-semibold text-fg">{news.title}</h1>

      <p className="font-score text-xs text-ink-500">
        {formatIctDate(news.publishedAt)}
      </p>

      <div className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
        {news.body}
      </div>
    </div>
  );
}

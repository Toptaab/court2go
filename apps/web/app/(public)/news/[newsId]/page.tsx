'use client';

import { useParams, useRouter } from 'next/navigation';
import { useNewsDetail } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';

/**
 * News Detail page — shows full news article content.
 */
export default function NewsDetailPage() {
  const { newsId } = useParams<{ newsId: string }>();
  const router = useRouter();
  const slug = getDevDefaultTenantSlug();
  const { data: news, isLoading, isError } = useNewsDetail(slug, newsId);

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="h-[38px] w-[38px] animate-pulse rounded-[10px] bg-surface-2" />
          <div className="h-5 w-40 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="p-4">
          <div className="h-40 animate-pulse rounded-card bg-surface-2" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-surface-2" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
    );
  }

  if (isError || !news) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink-700"
            aria-label="Go back"
          >
            ←
          </button>
          <span className="text-base font-bold text-fg">News</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-fg-muted">ไม่สามารถโหลดข่าวได้ / Unable to load this article.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* App bar */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-line bg-surface text-lg text-ink-700"
          aria-label="Go back"
        >
          ←
        </button>
        <span className="line-clamp-1 text-base font-bold text-fg">{news.title}</span>
      </div>

      {/* Cover image */}
      {news.imageUrl && (
        <div className="aspect-video w-full overflow-hidden bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={news.imageUrl}
            alt={news.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Article content */}
      <div className="p-4">
        <h1 className="text-lg font-bold text-fg">{news.title}</h1>
        <div className="mt-1.5 text-xs text-fg-muted">
          {new Date(news.publishedAt).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>

        <div className="mt-4 text-sm leading-relaxed text-fg-muted">
          {news.body}
        </div>
      </div>
    </div>
  );
}

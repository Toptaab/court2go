'use client';

import Link from 'next/link';
import { useNews } from '@/lib/hooks/use-public-catalog';
import { usePublicTenant } from '@/lib/hooks/use-public-tenant';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatIctDate } from '@/lib/format';
import { Button } from '@/components/ui/button';

/**
 * Public home — shows tenant name + latest news + navigation to branches.
 * Design M1: Full-width hero with grid overlay, news cards with tag/date structure,
 * and a bottom action bar with "Book Now" CTA.
 */
export default function PublicHomePage() {
  const slug = getDevDefaultTenantSlug();
  const { data: tenant } = usePublicTenant(slug);
  const { data: news, isLoading } = useNews(slug, 1, 5);

  return (
    <div className="flex min-h-full flex-col">
      {/* Hero banner — full-width gradient with grid-line overlay (M1 design) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-accent to-[color-mix(in_oklab,var(--accent),#000_14%)] px-5 py-6 text-white">
        {/* Grid lines decorative overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 34px), repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 34px)',
          }}
        />
        <h2 className="relative text-[22px] font-extrabold leading-tight tracking-[-0.01em]">
          {tenant?.name ?? 'Baseline Club'}
        </h2>
        <p className="relative mt-1 text-[13px] opacity-90">
          จองสนามกีฬาใกล้บ้านคุณ · Book courts near you
        </p>
      </section>

      {/* News feed content */}
      <section className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-5">
        {/* Section label */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Latest news
          </span>
          <Link href="/news" className="text-xs font-medium text-accent hover:underline">
            ดูทั้งหมด
          </Link>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
                <div className="h-[120px] animate-pulse bg-surface-2" />
                <div className="space-y-2 p-3.5">
                  <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
                  <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {news && news.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">📰</span>
            <p className="text-sm text-ink-500">ไม่มีข่าวสาร / No news yet.</p>
          </div>
        )}

        {/* News cards (M1 design: image + tag + title + body + date) */}
        {news?.items.map((item) => (
          <Link key={item.id} href={`/news/${item.id}`} className="block">
            <article className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md">
              {/* Image area */}
              <div className="relative grid h-[120px] place-items-center bg-surface-2">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-3xl text-ink-300">🏟️</span>
                )}
              </div>
              {/* Text content */}
              <div className="px-3.5 py-3">
                {/* Tag */}
                <span className="font-mono text-[10px] tracking-[0.06em] text-accent">
                  NEWS
                </span>
                {/* Title */}
                <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug">
                  {item.title}
                </h3>
                {/* Body excerpt */}
                {item.body && (
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">
                    {item.body}
                  </p>
                )}
                {/* Date */}
                <p className="mt-2 font-mono text-[10px] text-ink-300">
                  {formatIctDate(item.publishedAt)}
                </p>
              </div>
            </article>
          </Link>
        ))}
      </section>

      {/* Bottom action bar — sticky CTA (M1 design) */}
      <div className="sticky bottom-0 border-t border-line bg-surface px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <Link href="/branches" className="block">
          <Button variant="primary" size="lg" className="w-full text-base font-semibold">
            Book Now
          </Button>
        </Link>
      </div>
    </div>
  );
}

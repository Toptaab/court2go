'use client';

import Link from 'next/link';
import { useNews } from '@/lib/hooks/use-public-catalog';
import { usePublicTenant } from '@/lib/hooks/use-public-tenant';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatIctDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Public home — shows tenant name + latest news + navigation to branches.
 * Design M1: Hero banner + news feed is the default public landing.
 */
export default function PublicHomePage() {
  const slug = getDevDefaultTenantSlug();
  const { data: tenant } = usePublicTenant(slug);
  const { data: news, isLoading } = useNews(slug, 1, 5);

  return (
    <div className="flex flex-col gap-0">
      {/* Hero banner (Design M1) — gradient accent with grid overlay */}
      <div className="relative overflow-hidden bg-gradient-to-br from-accent to-accent/80 px-4 py-6 text-white">
        {/* Grid lines decorative overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 34px), repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 34px)',
          }}
        />
        <h2 className="relative font-disp text-[22px] font-extrabold leading-tight tracking-tight">
          {tenant?.name ?? 'Baseline Club'}
        </h2>
        <p className="relative mt-1 text-[13px] opacity-90">
          จองสนามกีฬาใกล้บ้านคุณ / Book courts near you
        </p>
      </div>

      {/* Content below hero */}
      <div className="flex flex-col gap-4 px-4 pt-5">
        {/* Quick nav */}
        <Link href="/branches">
          <Button variant="primary" size="lg" className="w-full">
            Book Now
          </Button>
        </Link>

        {/* Latest news */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Latest news
            </span>
            <Link href="/news" className="text-xs text-accent hover:underline">
              ดูทั้งหมด / See all
            </Link>
          </div>

          {isLoading && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-card bg-surface-2" />
              ))}
            </div>
          )}

          {news && news.items.length === 0 && (
            <p className="text-sm text-fg-muted">ไม่มีข่าวสาร / No news yet.</p>
          )}

          {news?.items.map((item) => (
            <Link key={item.id} href={`/news/${item.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-32 w-full rounded-t-card object-cover"
                  />
                )}
                <CardHeader className="pb-1">
                  <CardTitle className="line-clamp-2 text-sm">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-xs text-fg-muted">{item.body}</p>
                  <p className="mt-1 font-score text-xs text-ink-500">
                    {formatIctDate(item.publishedAt)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

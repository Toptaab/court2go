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
 * Design M1: news feed is the default public landing.
 */
export default function PublicHomePage() {
  const slug = getDevDefaultTenantSlug();
  const { data: tenant } = usePublicTenant(slug);
  const { data: news, isLoading } = useNews(slug, 1, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Tenant header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-disp text-xl font-semibold text-fg">
          {tenant?.name ?? 'court2go'}
        </h1>
        <p className="text-sm text-fg-muted">
          จองสนามกีฬาใกล้บ้านคุณ / Book courts near you.
        </p>
      </div>

      {/* Quick nav */}
      <Link href="/branches">
        <Button variant="primary" className="w-full">
          ดูสนาม / Browse courts
        </Button>
      </Link>

      {/* Latest news */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">ข่าวสาร / News</h2>
          <Link href="/news" className="text-xs text-accent hover:underline">
            ดูทั้งหมด / See all
          </Link>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-card bg-surface-2" />
            ))}
          </div>
        )}

        {news && news.items.length === 0 && (
          <p className="text-sm text-fg-muted">ไม่มีข่าวสาร / No news yet.</p>
        )}

        {news?.items.map((item) => (
          <Link key={item.id} href={`/news/${item.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-1">
                <CardTitle className="line-clamp-1 text-sm">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-1 text-xs text-fg-muted">{item.body}</p>
                <p className="mt-1 font-score text-xs text-ink-500">
                  {formatIctDate(item.publishedAt)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}

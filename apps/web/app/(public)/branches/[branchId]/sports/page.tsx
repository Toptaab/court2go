'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSports, useCourts } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { formatTHB } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

/**
 * Sport list + courts for a branch (Design M4 → M5 transition).
 * Shows sports offered at this branch, and under each sport its courts
 * with grid interval + base price. Each court links to the court detail
 * (availability grid / slot picker).
 */
export default function BranchSportsPage() {
  const params = useParams<{ branchId: string }>();
  const slug = getDevDefaultTenantSlug();
  const { data: sports, isLoading: sportsLoading } = useSports(slug, params.branchId);
  const { data: courts, isLoading: courtsLoading } = useCourts(slug, params.branchId);

  const isLoading = sportsLoading || courtsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-disp text-lg font-semibold text-fg">กีฬา / Sports</h1>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-card bg-surface-2" />
        ))}
      </div>
    );
  }

  if (!sports || !courts) {
    return (
      <div className="flex flex-col gap-3">
        <Link href="/branches" className="text-sm text-accent hover:underline">
          ← สาขาทั้งหมด / All branches
        </Link>
        <p className="text-sm text-fg-muted">
          ไม่สามารถโหลดข้อมูลได้ / Unable to load data.
        </p>
      </div>
    );
  }

  // Group courts by sportId for display under each sport heading
  const courtsBySport = new Map<string, typeof courts>();
  for (const court of courts) {
    const list = courtsBySport.get(court.sportId) ?? [];
    list.push(court);
    courtsBySport.set(court.sportId, list);
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/branches" className="text-sm text-accent hover:underline">
        ← สาขาทั้งหมด / All branches
      </Link>

      <h1 className="font-disp text-lg font-semibold text-fg">เลือกสนาม / Choose a court</h1>

      {sports.length === 0 && (
        <p className="text-sm text-fg-muted">ไม่มีกีฬา / No sports available.</p>
      )}

      {sports.map((sport) => {
        const sportCourts = courtsBySport.get(sport.id) ?? [];
        return (
          <section key={sport.id} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-fg">{sport.name}</h2>

            {sportCourts.length === 0 && (
              <p className="text-xs text-fg-muted">ไม่มีสนาม / No courts.</p>
            )}

            {sportCourts.map((court) => (
              <Link key={court.id} href={`/courts/${court.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm">{court.name}</CardTitle>
                    <CardDescription>
                      {court.gridIntervalMinutes} นาที/ช่วง · สูงสุด {court.maxSlots} ช่วง
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="font-score text-xs text-ink-500">
                      เริ่มต้น {formatTHB(court.basePricePerGridUnit)} / ช่วง
                    </p>
                    <p className="text-xs text-fg-muted">
                      From {formatTHB(court.basePricePerGridUnit)} / slot
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}

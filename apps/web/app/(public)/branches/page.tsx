'use client';

import Link from 'next/link';
import { useBranches } from '@/lib/hooks/use-public-catalog';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/**
 * Branch list — all active branches for the tenant (Design M3).
 * Each card links into the sport-picker for that branch.
 */
export default function BranchListPage() {
  const slug = getDevDefaultTenantSlug();
  const { data: branches, isLoading, isError } = useBranches(slug);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-disp text-lg font-semibold text-fg">สาขา / Branches</h1>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-card bg-surface-2" />
        ))}
      </div>
    );
  }

  if (isError || !branches) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-disp text-lg font-semibold text-fg">สาขา / Branches</h1>
        <p className="text-sm text-fg-muted">
          ไม่สามารถโหลดข้อมูลสาขาได้ / Unable to load branches.
        </p>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-disp text-lg font-semibold text-fg">สาขา / Branches</h1>
        <p className="text-sm text-fg-muted">ไม่มีสาขา / No branches available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-disp text-lg font-semibold text-fg">สาขา / Branches</h1>

      {branches.map((branch) => (
        <Link key={branch.id} href={`/branches/${branch.id}/sports`}>
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>{branch.name}</CardTitle>
              <CardDescription className="line-clamp-2">
                {branch.address}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}

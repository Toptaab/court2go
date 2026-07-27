import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookingStatusBadge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/guards';

/**
 * Placeholder — exercises `(admin)/layout.tsx` + the shared `components/ui`
 * primitives for `next build`. Real content (calendar D1, booking list D2)
 * lands in M10.7, behind the admin-session guard added in M10.2
 * (`requireAdminSession` redirects to `/admin/login` — a 404 until M10.7
 * creates that route, which is expected for this plumbing-only slice).
 *
 * Route is `app/(admin)/admin/page.tsx` → `/admin` (not `/`), for the same
 * route-group collision reason documented in `(member)/layout.tsx`.
 */
export default async function AdminHomePage() {
  const admin = await requireAdminSession();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">Admin console</h1>
      <Card>
        <CardHeader>
          <CardTitle>Scaffold check — signed in as {admin.name} ({admin.role})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <BookingStatusBadge status="CONFIRMED" />
        </CardContent>
      </Card>
    </div>
  );
}

import { requireMemberSession } from '@/lib/auth/guards';

/**
 * Placeholder — exercises `(member)/layout.tsx` for `next build`. Real
 * content (profile M19, my-bookings M14) lands in M10.4/M10.5, behind the
 * member-session guard added in M10.2 (`requireMemberSession` redirects to
 * `/` when there's no valid Member session).
 */
export default async function MemberAccountPage() {
  const me = await requireMemberSession();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-disp text-xl font-semibold text-fg">บัญชีของฉัน / My account</h1>
      <p className="text-sm text-fg-muted">Member area placeholder. Signed in as {me.phone ?? me.id}.</p>
    </div>
  );
}

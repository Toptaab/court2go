import { requireMemberSession } from '@/lib/auth/guards';
import { AccountTabs } from './account-tabs';

/**
 * Member account page with tabs (Design M14/M19 — acctabs component).
 * Server Component guards the session, then renders tabbed client view.
 */
export default async function MemberAccountPage() {
  const me = await requireMemberSession('/login');

  return <AccountTabs initialMe={me} />;
}

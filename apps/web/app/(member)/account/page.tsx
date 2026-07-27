import { requireMemberSession } from '@/lib/auth/guards';
import { ProfileView } from './profile-view';

/**
 * Member profile page (Design M19). Server Component that guards the session,
 * then renders the client ProfileView with the resolved member data.
 */
export default async function MemberAccountPage() {
  const me = await requireMemberSession('/login');

  return <ProfileView initialMe={me} />;
}

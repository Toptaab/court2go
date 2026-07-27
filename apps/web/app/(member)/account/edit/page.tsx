import { requireMemberSession } from '@/lib/auth/guards';
import { ProfileEditForm } from './profile-edit-form';

/**
 * Profile edit page (Design M17). Server Component guard → client form.
 */
export default async function ProfileEditPage() {
  const me = await requireMemberSession('/login');

  return <ProfileEditForm initialMe={me} />;
}

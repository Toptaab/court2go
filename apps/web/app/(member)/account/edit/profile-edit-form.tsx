'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Me, Sex } from '@repo/types';
import { useUpdateProfile } from '@/lib/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { messageForError } from '@/lib/error';

interface ProfileEditFormProps {
  initialMe: Me;
}

/**
 * Profile edit form (Design M17). Editable fields: name, sex, emergencyContact.
 * Phone is IMMUTABLE here (changes via OTP BIND only) — shown as read-only.
 */
export function ProfileEditForm({ initialMe }: ProfileEditFormProps) {
  const router = useRouter();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState(initialMe.name ?? '');
  const [sex, setSex] = useState<Sex | ''>(initialMe.sex ?? '');
  const [emergencyContact, setEmergencyContact] = useState(
    initialMe.emergencyContact ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      await updateProfile.mutateAsync({
        name: name.trim() || null,
        sex: (sex as Sex) || null,
        emergencyContact: emergencyContact.trim() || null,
      });
      setSuccess(true);
      // Navigate back to profile after short delay so user sees success
      setTimeout(() => router.push('/account'), 800);
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-disp text-xl font-semibold text-fg">
          แก้ไขโปรไฟล์ / Edit profile
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-sm text-status-danger">{error}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="rounded-card border border-status-ok/20 bg-status-ok/5 px-3 py-2">
          <p className="text-sm text-status-ok">
            บันทึกสำเร็จ / Saved successfully.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Phone (read-only) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-fg">
                เบอร์โทร / Phone
              </label>
              <input
                type="text"
                value={initialMe.phone ?? '—'}
                disabled
                className="rounded-card border border-line-100 bg-surface-2 px-3 py-2.5 text-sm text-ink-500"
              />
              <p className="text-xs text-fg-muted">
                เปลี่ยนเบอร์โทรได้ผ่าน OTP เท่านั้น / Phone can only be changed via OTP verification.
              </p>
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-name" className="text-sm font-medium text-fg">
                ชื่อ / Name
              </label>
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อเล่นหรือชื่อจริง"
                maxLength={120}
                className="rounded-card border border-line-300 bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Sex */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-sex" className="text-sm font-medium text-fg">
                เพศ / Sex
              </label>
              <select
                id="edit-sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex | '')}
                className="rounded-card border border-line-300 bg-surface px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">ไม่ระบุ / Not specified</option>
                <option value="MALE">ชาย / Male</option>
                <option value="FEMALE">หญิง / Female</option>
                <option value="OTHER">อื่น ๆ / Other</option>
              </select>
            </div>

            {/* Emergency contact */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-emergency" className="text-sm font-medium text-fg">
                ผู้ติดต่อฉุกเฉิน / Emergency contact
              </label>
              <input
                id="edit-emergency"
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="ชื่อและเบอร์โทร"
                maxLength={120}
                className="rounded-card border border-line-300 bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push('/account')}
              >
                ยกเลิก / Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? 'กำลังบันทึก...' : 'บันทึก / Save'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

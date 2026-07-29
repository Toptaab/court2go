'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminCreateBookingBodySchema, type AdminCreateBookingBody } from '@repo/types';
import { useBranches, useCourts } from '@/lib/hooks/use-public-catalog';
import { useAdminWalkInCreate } from '@/lib/hooks/use-admin-booking-actions';
import { getDevDefaultTenantSlug } from '@/lib/tenant';
import { messageForError } from '@/lib/error';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AvailabilityPicker, type AvailabilitySelection } from '@/components/booking/availability-picker';
import { cn } from '@/lib/utils';

type MemberMode = 'phone' | 'id';

interface WalkInModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-select a branch (e.g. the branch currently shown on the calendar). */
  initialBranchId?: string;
}

/**
 * Staff walk-in booking (Design D6, PRD A2.2), as a modal launched from the
 * Bookings and Calendar pages rather than its own nav route. No OTP — the
 * booking is created with `verifiedVia: ADM_OVERRIDE` server-side, auditable.
 * Member is either quick-created by phone (primary path here; full admin
 * member search is M10.10) or attached to an existing member by raw id.
 *
 * Reuses the M10.3 `AvailabilityPicker` (date/start/slot-count grid + server
 * price preview) — this modal only adds branch/court selection above it and
 * the member/promo/payment fields + submit below the price, via `footer`.
 * Price is always the server's preview; the authoritative price is
 * re-derived by `POST /admin/bookings` regardless of what's shown here.
 */
export function WalkInModal({ open, onClose, initialBranchId }: WalkInModalProps) {
  const router = useRouter();
  const slug = getDevDefaultTenantSlug();

  const [branchId, setBranchId] = useState(initialBranchId ?? '');
  const [courtId, setCourtId] = useState('');

  const [memberMode, setMemberMode] = useState<MemberMode>('phone');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [memberId, setMemberId] = useState('');

  const [promoCode, setPromoCode] = useState('');
  const [directConfirmPayment, setDirectConfirmPayment] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const { data: branches, isLoading: branchesLoading } = useBranches(slug);
  const { data: courts, isLoading: courtsLoading } = useCourts(slug, branchId);
  const walkInCreate = useAdminWalkInCreate();

  const resetForm = () => {
    setBranchId(initialBranchId ?? '');
    setCourtId('');
    setMemberMode('phone');
    setNewMemberPhone('');
    setNewMemberName('');
    setMemberId('');
    setPromoCode('');
    setDirectConfirmPayment(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleBranchChange = (id: string) => {
    setBranchId(id);
    setCourtId('');
  };

  const handleSubmit = async (selection: AvailabilitySelection) => {
    setError(null);

    const draft: Record<string, unknown> = {
      courtId,
      start: selection.startsAt,
      slotCount: selection.slotCount,
      promoCode: promoCode.trim() ? promoCode.trim() : undefined,
      directConfirmPayment,
    };
    if (memberMode === 'phone') {
      draft.newMemberPhone = newMemberPhone.trim();
      if (newMemberName.trim()) draft.newMemberName = newMemberName.trim();
    } else {
      draft.memberId = memberId.trim();
    }

    const parsed = adminCreateBookingBodySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณาตรวจสอบข้อมูล / Please check the form.');
      return;
    }

    try {
      const booking = await walkInCreate.mutateAsync(parsed.data as AdminCreateBookingBody);
      resetForm();
      onClose();
      router.push(`/admin/bookings/${booking.id}`);
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="สร้างการจองหน้างาน / Walk-in booking"
      subtitle="สำหรับลูกค้าที่มาจองหน้างานโดยไม่ผ่าน OTP / For customers booking on-site, without OTP."
      className="max-w-xl"
    >
      <div className="flex flex-col gap-5">
        {error && (
          <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
            <p className="text-sm text-status-danger">{error}</p>
          </div>
        )}

        {/* Branch + court selection */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wi-branch" className="text-sm font-medium text-fg">
              สาขา / Branch
            </label>
            <select
              id="wi-branch"
              value={branchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={branchesLoading}
              className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg"
            >
              <option value="">เลือกสาขา / Select branch</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="wi-court" className="text-sm font-medium text-fg">
              สนาม / Court
            </label>
            <select
              id="wi-court"
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              disabled={!branchId || courtsLoading}
              className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg"
            >
              <option value="">เลือกสนาม / Select court</option>
              {courts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date/time/slots + member + submit */}
        {courtId && (
          <AvailabilityPicker
            key={courtId}
            slug={slug}
            courtId={courtId}
            footer={(selection) => (
              <div className="flex flex-col gap-3 border-t border-line-100 pt-3">
                {/* Member entry mode toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMemberMode('phone')}
                    className={cn(
                      'flex-1 rounded-card border px-3 py-2 text-xs transition-colors',
                      memberMode === 'phone'
                        ? 'border-accent bg-accent text-white'
                        : 'border-line-100 bg-surface text-fg hover:bg-surface-2',
                    )}
                  >
                    ลูกค้าใหม่ (เบอร์โทร) / New (phone)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberMode('id')}
                    className={cn(
                      'flex-1 rounded-card border px-3 py-2 text-xs transition-colors',
                      memberMode === 'id'
                        ? 'border-accent bg-accent text-white'
                        : 'border-line-100 bg-surface text-fg hover:bg-surface-2',
                    )}
                  >
                    สมาชิกเดิม (รหัส) / Existing (member id)
                  </button>
                </div>

                {memberMode === 'phone' ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="wi-phone" className="text-xs font-medium text-fg">
                        เบอร์โทร / Phone
                      </label>
                      <input
                        id="wi-phone"
                        type="tel"
                        value={newMemberPhone}
                        onChange={(e) => setNewMemberPhone(e.target.value)}
                        placeholder="0812345678"
                        className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="wi-name" className="text-xs font-medium text-fg">
                        ชื่อ (ไม่บังคับ) / Name (optional)
                      </label>
                      <input
                        id="wi-name"
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="wi-member-id" className="text-xs font-medium text-fg">
                      รหัสสมาชิก (Member ID) / Member ID
                    </label>
                    <input
                      id="wi-member-id"
                      type="text"
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      placeholder="uuid"
                      className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wi-promo" className="text-xs font-medium text-fg">
                    โค้ดโปรโมชั่น (ไม่บังคับ) / Promo code (optional)
                  </label>
                  <input
                    id="wi-promo"
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="rounded-card border border-line-300 bg-surface px-3 py-2 text-sm text-fg placeholder:text-ink-300 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-fg">
                  <input
                    type="checkbox"
                    checked={directConfirmPayment}
                    onChange={(e) => setDirectConfirmPayment(e.target.checked)}
                    className="h-4 w-4 rounded border-line-300 accent-accent"
                  />
                  ยืนยันการชำระเงินทันที (รับเงินสดแล้ว) / Confirm payment now (cash collected)
                </label>

                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  disabled={walkInCreate.isPending}
                  onClick={() => handleSubmit(selection)}
                >
                  {walkInCreate.isPending ? 'กำลังสร้างการจอง...' : 'สร้างการจอง / Create booking'}
                </Button>
              </div>
            )}
          />
        )}
      </div>
    </Dialog>
  );
}

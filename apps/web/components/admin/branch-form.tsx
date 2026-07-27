'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { upsertBranchBodySchema, type Branch, type UpsertBranchBody, type BusinessHoursDay } from '@repo/types';
import { DAYS_OF_WEEK, type DayOfWeek } from '@repo/types';
import { useCreateBranch, useUpdateBranch } from '@/lib/hooks/use-admin-catalog';
import { messageForError } from '@/lib/error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: 'จันทร์ / Mon',
  TUE: 'อังคาร / Tue',
  WED: 'พุธ / Wed',
  THU: 'พฤหัสบดี / Thu',
  FRI: 'ศุกร์ / Fri',
  SAT: 'เสาร์ / Sat',
  SUN: 'อาทิตย์ / Sun',
};

function defaultBusinessHours(): BusinessHoursDay[] {
  return DAYS_OF_WEEK.map((day) => ({ day, closed: false, openTime: '09:00', closeTime: '22:00' }));
}

interface BranchFormProps {
  /** Present when editing an existing Branch; omitted for create. */
  initial?: Branch;
}

/**
 * Shared Branch create/edit form (Design D9, PRD A4.1). Used by both
 * `.../branches/new/page.tsx` and `.../branches/[id]/page.tsx`.
 *
 * CROSS-FIELD RULE (PRD A4.1 AC6): `promptPayId` is required iff
 * `paymentMethod === 'QR_CODE'` — enforced here via `upsertBranchBodySchema`'s
 * own `.refine` (same schema the server validates with) before submit, and
 * the field is hidden entirely for `PAY_ONSITE` so there's nothing
 * conflicting to fill in.
 *
 * Business hours use the plain (non-lattice) `timeOfDaySchema` — any `HH:MM`
 * is valid, so a native `<input type="time">` is used (contrast the Court
 * schedule editor's `:00`/`:30`-only `<select>`, `lib/time-lattice.ts`).
 */
export function BranchForm({ initial }: BranchFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [paymentMethod, setPaymentMethod] = useState<UpsertBranchBody['paymentMethod']>(
    initial?.paymentMethod ?? 'PAY_ONSITE',
  );
  const [promptPayId, setPromptPayId] = useState(initial?.promptPayId ?? '');
  const [businessHours, setBusinessHours] = useState<BusinessHoursDay[]>(
    initial?.businessHours ?? defaultBusinessHours(),
  );
  const [error, setError] = useState<string | null>(null);

  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch(initial?.id ?? '');
  const mutation = isEdit ? updateBranch : createBranch;

  const updateDay = (index: number, patch: Partial<BusinessHoursDay>) => {
    setBusinessHours((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const handleSubmit = async () => {
    setError(null);

    const draft: unknown = {
      name: name.trim(),
      address: address.trim(),
      paymentMethod,
      promptPayId: paymentMethod === 'QR_CODE' ? promptPayId.trim() || null : null,
      businessHours: businessHours.map((d) => ({
        ...d,
        openTime: d.closed ? null : d.openTime,
        closeTime: d.closed ? null : d.closeTime,
      })),
    };

    const parsed = upsertBranchBodySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณาตรวจสอบข้อมูล / Please check the form.');
      return;
    }

    try {
      await mutation.mutateAsync(parsed.data);
      router.push('/admin/catalog/branches');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-sm text-status-danger">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ข้อมูลสาขา / Branch details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-name">ชื่อสาขา / Name</Label>
            <Input id="branch-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-address">ที่อยู่ / Address</Label>
            <Input id="branch-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch-payment-method">วิธีชำระเงิน / Payment method</Label>
            <Select
              id="branch-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as UpsertBranchBody['paymentMethod'])}
            >
              <option value="PAY_ONSITE">ชำระที่สนาม / Pay onsite</option>
              <option value="QR_CODE">พร้อมเพย์ / QR Code (PromptPay)</option>
            </Select>
          </div>
          {paymentMethod === 'QR_CODE' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-promptpay">
                หมายเลขพร้อมเพย์ / PromptPay ID (เบอร์โทร/เลขบัตร ปชช./e-wallet)
              </Label>
              <Input
                id="branch-promptpay"
                value={promptPayId}
                onChange={(e) => setPromptPayId(e.target.value)}
                placeholder="0812345678"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">เวลาทำการ / Business hours</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {businessHours.map((d, i) => (
            <div key={d.day} className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 text-xs font-medium text-fg">{DAY_LABELS[d.day]}</span>
              <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                <input
                  type="checkbox"
                  checked={d.closed}
                  onChange={(e) => updateDay(i, { closed: e.target.checked })}
                  className="h-4 w-4 rounded border-line-300 accent-accent"
                />
                ปิด / Closed
              </label>
              {!d.closed && (
                <>
                  <Input
                    type="time"
                    value={d.openTime ?? ''}
                    onChange={(e) => updateDay(i, { openTime: e.target.value })}
                    className="w-28"
                  />
                  <span className="text-xs text-fg-muted">–</span>
                  <Input
                    type="time"
                    value={d.closeTime ?? ''}
                    onChange={(e) => updateDay(i, { closeTime: e.target.value })}
                    className="w-28"
                  />
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={mutation.isPending}
          onClick={handleSubmit}
        >
          {mutation.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก / Save' : 'สร้างสาขา / Create branch'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/catalog/branches')}>
          ยกเลิก / Cancel
        </Button>
      </div>
    </div>
  );
}

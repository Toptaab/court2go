'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { upsertPromotionBodySchema, type Promotion, type UpsertPromotionBody } from '@repo/types';
import { useAdminBranches, useAdminSports, useAdminCourts } from '@/lib/hooks/use-admin-catalog';
import { useCreatePromotion, useUpdatePromotion } from '@/lib/hooks/use-admin-promotions';
import { messageForError } from '@/lib/error';
import { satangToThbInput, thbInputToSatang } from '@/lib/format';
import { ictLocalToUtcIso, utcIsoToIctLocal } from '@/lib/ict-date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface PromotionFormProps {
  /** Present when editing an existing Promotion; omitted for create. */
  initial?: Promotion;
}

/**
 * Shared Promotion create/edit form (Design D11, PRD A6). Used by both
 * `.../promotions/new/page.tsx` and `.../promotions/[id]/page.tsx`.
 *
 * PERCENTAGE-VS-SATANG RULE (critical — CLAUDE.md "price is always
 * re-derived server-side" + this slice's validation notes): `discountValue`
 * on the wire is a WHOLE integer 1..100 for PERCENTAGE, but THB satang for
 * FIXED. Only the FIXED input round-trips through `satangToThbInput`/
 * `thbInputToSatang`; the PERCENTAGE input is a plain integer field. Toggling
 * `discountType` resets the raw input state to avoid submitting a stale
 * "300.00" THB string as a percentage or vice versa.
 */
export function PromotionForm({ initial }: PromotionFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const { data: branches } = useAdminBranches();
  const { data: sports } = useAdminSports();

  const [code, setCode] = useState(initial?.code ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [discountType, setDiscountType] = useState<UpsertPromotionBody['discountType']>(
    initial?.discountType ?? 'PERCENTAGE',
  );
  const [percentInput, setPercentInput] = useState(
    initial && initial.discountType === 'PERCENTAGE' ? String(initial.discountValue) : '10',
  );
  const [thbInput, setThbInput] = useState(
    satangToThbInput(initial && initial.discountType === 'FIXED' ? initial.discountValue : 0),
  );
  const [validFrom, setValidFrom] = useState(
    initial ? utcIsoToIctLocal(initial.validFrom) : '',
  );
  const [validUntil, setValidUntil] = useState(
    initial ? utcIsoToIctLocal(initial.validUntil) : '',
  );
  const [branchId, setBranchId] = useState(initial?.branchId ?? '');
  const [sportId, setSportId] = useState(initial?.sportId ?? '');
  const [courtId, setCourtId] = useState(initial?.courtId ?? '');
  const [maxTotalUses, setMaxTotalUses] = useState(
    initial?.maxTotalUses != null ? String(initial.maxTotalUses) : '',
  );
  const [maxUsesPerMember, setMaxUsesPerMember] = useState(
    initial?.maxUsesPerMember != null ? String(initial.maxUsesPerMember) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const { data: courts } = useAdminCourts(branchId || undefined);

  const createPromotion = useCreatePromotion();
  const updatePromotion = useUpdatePromotion(initial?.id ?? '');
  const mutation = isEdit ? updatePromotion : createPromotion;

  const handleDiscountTypeChange = (next: UpsertPromotionBody['discountType']) => {
    setDiscountType(next);
    // Reset the OTHER field's raw input so a stale value can't leak across
    // types (see file header note).
    if (next === 'PERCENTAGE') setPercentInput('10');
    else setThbInput(satangToThbInput(0));
  };

  const handleSubmit = async () => {
    setError(null);

    const draft: unknown = {
      code: code.trim(),
      description: description.trim() || null,
      discountType,
      discountValue:
        discountType === 'PERCENTAGE' ? Number(percentInput) : thbInputToSatang(thbInput),
      validFrom: validFrom ? ictLocalToUtcIso(validFrom) : '',
      validUntil: validUntil ? ictLocalToUtcIso(validUntil) : '',
      branchId: branchId || null,
      sportId: sportId || null,
      courtId: courtId || null,
      maxTotalUses: maxTotalUses.trim() ? Number(maxTotalUses) : null,
      maxUsesPerMember: maxUsesPerMember.trim() ? Number(maxUsesPerMember) : null,
    };

    const parsed = upsertPromotionBodySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณาตรวจสอบข้อมูล / Please check the form.');
      return;
    }

    try {
      await mutation.mutateAsync(parsed.data);
      router.push('/admin/promotions');
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
          <CardTitle className="text-sm">ข้อมูลโปรโมชั่น / Promotion details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-code">โค้ด / Code</Label>
              <Input id="promo-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น SUMMER10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-description">คำอธิบาย (ไม่บังคับ) / Description (optional)</Label>
              <Input
                id="promo-description"
                value={description ?? ''}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-discount-type">ประเภทส่วนลด / Discount type</Label>
              <Select
                id="promo-discount-type"
                value={discountType}
                onChange={(e) => handleDiscountTypeChange(e.target.value as UpsertPromotionBody['discountType'])}
              >
                <option value="PERCENTAGE">เปอร์เซ็นต์ / Percentage</option>
                <option value="FIXED">จำนวนคงที่ / Fixed amount</option>
              </Select>
            </div>
            {discountType === 'PERCENTAGE' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promo-percent">ส่วนลด (%) / Discount (%, 1-100)</Label>
                <Input
                  id="promo-percent"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={percentInput}
                  onChange={(e) => setPercentInput(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promo-fixed">ส่วนลด (บาท) / Discount (THB)</Label>
                <Input
                  id="promo-fixed"
                  type="number"
                  min={0}
                  step="0.01"
                  value={thbInput}
                  onChange={(e) => setThbInput(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-valid-from">เริ่มใช้ได้ / Valid from</Label>
              <Input
                id="promo-valid-from"
                type="datetime-local"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-valid-until">ใช้ได้ถึง / Valid until</Label>
              <Input
                id="promo-valid-until"
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ขอบเขต (ไม่บังคับ) / Scope (optional)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-fg-muted">
            ปล่อยว่างเพื่อใช้ได้ทั้งสถานที่ / Leave blank to apply tenant-wide.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-branch">สาขา / Branch</Label>
              <Select
                id="promo-branch"
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setCourtId('');
                }}
              >
                <option value="">ทั้งหมด / All branches</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-sport">กีฬา / Sport</Label>
              <Select id="promo-sport" value={sportId} onChange={(e) => setSportId(e.target.value)}>
                <option value="">ทั้งหมด / All sports</option>
                {sports?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-court">สนาม / Court</Label>
              <Select id="promo-court" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
                <option value="">ทั้งหมด / All courts</option>
                {courts?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ขีดจำกัดการใช้งาน (ไม่บังคับ) / Usage caps (optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="promo-max-total">จำนวนใช้ได้ทั้งหมด / Max total uses</Label>
            <Input
              id="promo-max-total"
              type="number"
              min={1}
              value={maxTotalUses}
              onChange={(e) => setMaxTotalUses(e.target.value)}
              placeholder="ไม่จำกัด / Unlimited"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="promo-max-per-member">จำนวนใช้ได้ต่อสมาชิก / Max uses per member</Label>
            <Input
              id="promo-max-per-member"
              type="number"
              min={1}
              value={maxUsesPerMember}
              onChange={(e) => setMaxUsesPerMember(e.target.value)}
              placeholder="ไม่จำกัด / Unlimited"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="button" variant="primary" disabled={mutation.isPending} onClick={handleSubmit}>
          {mutation.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก / Save' : 'สร้างโปรโมชั่น / Create promotion'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/promotions')}>
          ยกเลิก / Cancel
        </Button>
      </div>
    </div>
  );
}

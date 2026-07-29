'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertCourtBodySchema,
  DAYS_OF_WEEK,
  GRID_INTERVAL_MINUTES,
  type Court,
  type CourtScheduleDay,
  type PeakTimeRange,
  type PeakTimeRangeInput,
  type DayOfWeek,
  type GridIntervalMinutes,
} from '@repo/types';
import { computePriceBreakdown, minutesToTime, timeToMinutes } from '@repo/domain';
import { useAdminBranches, useAdminSports, useCreateCourt, useUpdateCourt } from '@/lib/hooks/use-admin-catalog';
import { messageForError } from '@/lib/error';
import { satangToThbInput, thbInputToSatang, formatTHB } from '@/lib/format';
import { LATTICE_TIME_OPTIONS } from '@/lib/time-lattice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: 'จ',
  TUE: 'อ',
  WED: 'พ',
  THU: 'พฤ',
  FRI: 'ศ',
  SAT: 'ส',
  SUN: 'อา',
};

const DAY_LABELS_EN: Record<DayOfWeek, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

function defaultSchedule(): CourtScheduleDay[] {
  return DAYS_OF_WEEK.map((day) => ({ day, closed: false, openTime: '09:00', closeTime: '22:00' }));
}

let peakRowKey = 0;

/**
 * Peak-range row shape held in component state. `priceInput` is a RAW
 * editable THB string (mirrors `basePriceInput` above) — it is converted to
 * an integer satang `pricePerGridUnit` only at submit time. Do not store
 * `pricePerGridUnit` (satang) directly on the row: round-tripping an
 * editable number input through satang on every keystroke snaps the
 * displayed value to `"X.00"` and makes multi-digit prices untypeable.
 */
type PeakRowState = Omit<PeakTimeRangeInput, 'pricePerGridUnit'> & { _key: number; priceInput: string };

function newPeakRow(): PeakRowState {
  return { _key: peakRowKey++, label: null, days: ['MON'], startTime: '18:00', endTime: '20:00', priceInput: satangToThbInput(0) };
}

const PRICING_PREVIEW_TARGET_MINUTES = 19 * 60; // sample anchor: 19:00, clamped into the day's open hours
const PRICING_PREVIEW_MAX_SLOTS = 3;

/**
 * Illustrative price breakdown for the "Pricing preview" panel (Design D7) —
 * genuinely computed from the form's own DRAFT values via the authoritative
 * `computePriceBreakdown` (`packages/domain`), never a re-implementation of
 * its rounding/peak-resolution logic (CLAUDE.md). Picks the first open day
 * (schedule order) and a sample start near 19:00, clamped to that day's
 * open/close bounds and grid-aligned to its openTime. Returns `null` if
 * every day is closed (nothing to preview).
 */
function buildPricingPreview(input: {
  gridIntervalMinutes: GridIntervalMinutes;
  maxSlots: number;
  basePricePerGridUnit: number;
  peakTimeRanges: PeakTimeRange[];
  schedule: CourtScheduleDay[];
}) {
  const { gridIntervalMinutes, maxSlots, basePricePerGridUnit, peakTimeRanges, schedule } = input;
  if (!Number.isFinite(basePricePerGridUnit)) return null;

  const openDay = schedule.find((d) => !d.closed && d.openTime && d.closeTime);
  if (!openDay || !openDay.openTime || !openDay.closeTime) return null;

  const openMinutes = timeToMinutes(openDay.openTime);
  const closeMinutes = timeToMinutes(openDay.closeTime);
  if (closeMinutes - openMinutes < gridIntervalMinutes) return null;

  const stepsFromOpen = Math.max(0, Math.round((PRICING_PREVIEW_TARGET_MINUTES - openMinutes) / gridIntervalMinutes));
  let startMinutes = openMinutes + stepsFromOpen * gridIntervalMinutes;
  if (startMinutes > closeMinutes - gridIntervalMinutes) startMinutes = openMinutes;

  const slotCount = Math.max(
    1,
    Math.min(PRICING_PREVIEW_MAX_SLOTS, maxSlots, Math.floor((closeMinutes - startMinutes) / gridIntervalMinutes)),
  );

  const breakdown = computePriceBreakdown({
    gridIntervalMinutes,
    slotCount,
    startMinutes,
    day: openDay.day,
    basePricePerGridUnit,
    peakTimeRanges,
  });

  return { day: openDay.day, breakdown };
}

interface CourtFormProps {
  /** Present when editing an existing Court; omitted for create. */
  initial?: Court;
  /** Pre-select a branch when creating from a filtered list — ignored when editing. */
  defaultBranchId?: string;
  /**
   * Hide the form's own bottom Save/Cancel row — used by the edit page,
   * which renders those as page-level topbar buttons instead (Design D7)
   * bound to this form via `form="court-form"` (native HTML association,
   * no prop-drilling of the submit handler needed).
   */
  hideInlineActions?: boolean;
  /** Reports the create/update mutation's pending state to a caller-owned topbar Save button. */
  onSubmittingChange?: (pending: boolean) => void;
}

/**
 * Shared Court create/edit form (Design D7, PRD A5.1). Used by both
 * `.../courts/new/page.tsx` and `.../courts/[id]/page.tsx`.
 *
 * LATTICE RULE: the schedule's open/close times are constrained to the
 * `:00`/`:30` lock lattice (`lib/time-lattice.ts`, `latticeAlignedTimeSchema`)
 * — offered ONLY via the `<select>` option list below, never a free-typed
 * time input, so a user can't slip in an off-lattice anchor. Peak-range
 * boundaries are the opposite: `timeOfDaySchema` is unconstrained there, so
 * a native `<input type="time">` is fine (matches `packages/types` exactly —
 * do not lattice-constrain peak ranges).
 *
 * A Branch-Admin submitting for a Branch outside their scope gets a 403
 * `BRANCH_SCOPE_DENIED` from the server — surfaced via `messageForError`
 * below rather than hidden/guessed at client-side.
 */
export function CourtForm({ initial, defaultBranchId, hideInlineActions, onSubmittingChange }: CourtFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const { data: branches } = useAdminBranches();
  const { data: sports } = useAdminSports();

  const [branchId, setBranchId] = useState(initial?.branchId ?? defaultBranchId ?? '');
  const [sportId, setSportId] = useState(initial?.sportId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [gridIntervalMinutes, setGridIntervalMinutes] = useState<GridIntervalMinutes>(
    initial?.gridIntervalMinutes ?? 60,
  );
  const [maxSlots, setMaxSlots] = useState(initial?.maxSlots ?? 4);
  const [basePriceInput, setBasePriceInput] = useState(
    satangToThbInput(initial?.basePricePerGridUnit ?? 0),
  );
  const [schedule, setSchedule] = useState<CourtScheduleDay[]>(initial?.schedule ?? defaultSchedule());
  const [peakRanges, setPeakRanges] = useState<PeakRowState[]>(
    (initial?.peakTimeRanges ?? []).map(({ pricePerGridUnit, ...p }) => ({
      ...p,
      _key: peakRowKey++,
      priceInput: satangToThbInput(pricePerGridUnit),
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const createCourt = useCreateCourt();
  const updateCourt = useUpdateCourt(initial?.id ?? '');
  const mutation = isEdit ? updateCourt : createCourt;

  useEffect(() => {
    onSubmittingChange?.(mutation.isPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report pending transitions only
  }, [mutation.isPending]);

  const updateScheduleDay = (index: number, patch: Partial<CourtScheduleDay>) => {
    setSchedule((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const updatePeakRow = (key: number, patch: Partial<PeakRowState>) => {
    setPeakRanges((prev) => prev.map((p) => (p._key === key ? { ...p, ...patch } : p)));
  };

  const togglePeakDay = (key: number, day: DayOfWeek) => {
    setPeakRanges((prev) =>
      prev.map((p) => {
        if (p._key !== key) return p;
        const has = p.days.includes(day);
        const days = has ? p.days.filter((d) => d !== day) : [...p.days, day];
        return { ...p, days };
      }),
    );
  };

  const pricingPreview = useMemo(
    () =>
      buildPricingPreview({
        gridIntervalMinutes,
        maxSlots,
        basePricePerGridUnit: thbInputToSatang(basePriceInput),
        peakTimeRanges: peakRanges.map((p) => ({
          id: String(p._key),
          label: p.label ?? null,
          days: p.days,
          startTime: p.startTime,
          endTime: p.endTime,
          pricePerGridUnit: Number.isFinite(thbInputToSatang(p.priceInput)) ? thbInputToSatang(p.priceInput) : 0,
        })),
        schedule,
      }),
    [gridIntervalMinutes, maxSlots, basePriceInput, peakRanges, schedule],
  );

  const handleSubmit = async () => {
    setError(null);

    const draft: unknown = {
      branchId,
      sportId,
      name: name.trim(),
      gridIntervalMinutes,
      maxSlots,
      basePricePerGridUnit: thbInputToSatang(basePriceInput),
      peakTimeRanges: peakRanges.map((p) => ({
        label: p.label?.trim() ? p.label.trim() : null,
        days: p.days,
        startTime: p.startTime,
        endTime: p.endTime,
        pricePerGridUnit: thbInputToSatang(p.priceInput),
      })),
      schedule: schedule.map((d) => ({
        ...d,
        openTime: d.closed ? null : d.openTime,
        closeTime: d.closed ? null : d.closeTime,
      })),
    };

    const parsed = upsertCourtBodySchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณาตรวจสอบข้อมูล / Please check the form.');
      return;
    }

    try {
      await mutation.mutateAsync(parsed.data);
      router.push('/admin/catalog/courts');
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <form
      id="court-form"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {error && (
        <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
          <p className="text-sm text-status-danger">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">ข้อมูลพื้นฐาน / Basics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="court-branch">สาขา / Branch</Label>
                  <Select id="court-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                    <option value="">เลือกสาขา / Select branch</option>
                    {branches?.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="court-sport">กีฬา / Sport</Label>
                  <Select id="court-sport" value={sportId} onChange={(e) => setSportId(e.target.value)}>
                    <option value="">เลือกกีฬา / Select sport</option>
                    {sports?.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="court-name">ชื่อสนาม / Court name</Label>
                <Input id="court-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-baseline justify-between gap-2">
                <CardTitle className="text-sm">ช่วงเวลากริด &amp; จำนวนช่องสูงสุด / Grid interval &amp; max slots</CardTitle>
                <span className="text-xs text-fg-muted">interval ∈ {'{30,60,90,120}'}</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>ช่วงเวลาต่อกริด (นาที) / Grid interval (min)</Label>
                <div className="flex gap-2">
                  {GRID_INTERVAL_MINUTES.map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant={gridIntervalMinutes === m ? 'primary' : 'outline'}
                      size="sm"
                      className="w-16 font-score"
                      aria-pressed={gridIntervalMinutes === m}
                      onClick={() => setGridIntervalMinutes(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="court-max-slots">จำนวนช่องสูงสุด / Max slots</Label>
                <Input
                  id="court-max-slots"
                  type="number"
                  min={1}
                  max={48}
                  value={maxSlots}
                  onChange={(e) => setMaxSlots(Number(e.target.value))}
                  className="max-w-[110px] font-score"
                />
                <p className="text-xs text-fg-muted">
                  จองต่อเนื่องได้สูงสุด = {maxSlots} × {gridIntervalMinutes} นาที = {maxSlots * gridIntervalMinutes} นาที
                  {' '}/ Longest booking = {maxSlots} × {gridIntervalMinutes} min = {maxSlots * gridIntervalMinutes} min.
                </p>
              </div>
              <p className="text-xs text-fg-muted">
                เวลาเริ่มต้องตรงกับกริดนี้ การจองครอบคลุม 1–maxSlots ช่องต่อเนื่อง การเปลี่ยนค่านี้มีผลกับการจองใหม่เท่านั้น / Start
                times land on this interval; a booking spans 1–maxSlots contiguous slots. Changing this affects new
                bookings only.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">ตารางเวลาเปิด-ปิด / Weekly schedule</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col">
              {schedule.map((d, i) => (
                <div
                  key={d.day}
                  className="grid grid-cols-[40px_auto_1fr] items-center gap-3 border-b border-line-100 py-2.5 text-sm last:border-b-0"
                >
                  <span className="font-medium text-fg">{DAY_LABELS_EN[d.day]}</span>
                  <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      checked={d.closed}
                      onChange={(e) => {
                        const closed = e.target.checked;
                        // Toggling closed -> open with no prior lattice anchor: seed a
                        // sensible default so the <Select> value matches state (UX-only —
                        // submission is already schema-guarded regardless).
                        const seedDefaults =
                          !closed && (d.openTime === null || d.closeTime === null)
                            ? { openTime: d.openTime ?? '08:00', closeTime: d.closeTime ?? '22:00' }
                            : {};
                        updateScheduleDay(i, { closed, ...seedDefaults });
                      }}
                      className="h-4 w-4 rounded border-line-300 accent-accent"
                    />
                    ปิด / Closed
                  </label>
                  {d.closed ? (
                    <span className="text-xs text-fg-muted">ปิดทั้งวัน / Closed all day</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={d.openTime ?? ''}
                        onChange={(e) => updateScheduleDay(i, { openTime: e.target.value })}
                        className="w-24 font-score"
                      >
                        {LATTICE_TIME_OPTIONS.filter((t) => t !== '24:00').map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </Select>
                      <span className="text-xs text-fg-muted">–</span>
                      <Select
                        value={d.closeTime ?? ''}
                        onChange={(e) => updateScheduleDay(i, { closeTime: e.target.value })}
                        className="w-24 font-score"
                      >
                        {LATTICE_TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">ราคา / Pricing</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setPeakRanges((prev) => [...prev, newPeakRow()])}>
                + เพิ่มช่วง / Add range
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="court-base-price">ราคาพื้นฐาน/กริด (บาท) / Base price per grid unit (THB)</Label>
                <Input
                  id="court-base-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={basePriceInput}
                  onChange={(e) => setBasePriceInput(e.target.value)}
                  className="font-score"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>ช่วงเวลาพีค / Peak time ranges</Label>
                {peakRanges.length === 0 && (
                  <p className="text-xs text-fg-muted">ไม่มีช่วงเวลาพีค / No peak ranges configured.</p>
                )}
                {peakRanges.map((p) => (
                  <div key={p._key} className="flex flex-col gap-2 rounded-card border border-line-100 bg-surface-2 p-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Label>ชื่อช่วง (ไม่บังคับ) / Label (optional)</Label>
                        <Input
                          value={p.label ?? ''}
                          onChange={(e) => updatePeakRow(p._key, { label: e.target.value })}
                          placeholder="เช่น เวลาเร่งด่วน / e.g. Evening peak"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>เริ่ม / Start</Label>
                        <Input
                          type="time"
                          value={p.startTime}
                          onChange={(e) => updatePeakRow(p._key, { startTime: e.target.value })}
                          className="w-28 font-score"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>สิ้นสุด / End</Label>
                        <Input
                          type="time"
                          value={p.endTime}
                          onChange={(e) => updatePeakRow(p._key, { endTime: e.target.value })}
                          className="w-28 font-score"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>ราคา/กริด (บาท) / Price (THB)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={p.priceInput}
                          onChange={(e) => updatePeakRow(p._key, { priceInput: e.target.value })}
                          className="w-28 font-score"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPeakRanges((prev) => prev.filter((row) => row._key !== p._key))}
                      >
                        ลบ / Remove
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-fg-muted">วัน / Days:</span>
                      {DAYS_OF_WEEK.map((day) => (
                        <label key={day} className="flex items-center gap-1 text-xs text-fg">
                          <input
                            type="checkbox"
                            checked={p.days.includes(day)}
                            onChange={() => togglePeakDay(p._key, day)}
                            className="h-3.5 w-3.5 rounded border-line-300 accent-accent"
                          />
                          {DAY_LABELS[day]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">ตัวอย่างราคา / Pricing preview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {pricingPreview ? (
                <>
                  <p className="text-xs text-fg-muted">
                    ตัวอย่าง / Sample · {DAY_LABELS_EN[pricingPreview.day]}{' '}
                    {minutesToTime(timeToMinutes(pricingPreview.breakdown.units[0]!.startTime))}, {pricingPreview.breakdown.slotCount}{' '}
                    ช่อง ({pricingPreview.breakdown.slotCount * gridIntervalMinutes} min) on a {gridIntervalMinutes}-min grid
                  </p>
                  <div className="flex flex-col gap-1 rounded-card border border-dashed border-line-300 bg-accent-tint p-3 text-xs">
                    {pricingPreview.breakdown.units.map((u) => (
                      <div key={u.index} className="flex items-center justify-between">
                        <span className="text-fg-muted">
                          {u.startTime}–{minutesToTime(timeToMinutes(u.startTime) + gridIntervalMinutes)} ·{' '}
                          {u.isPeak ? 'พีค / peak' : 'พื้นฐาน / base'}
                        </span>
                        <span className="font-score text-fg">{formatTHB(u.unitPrice)}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex items-center justify-between border-t border-accent/30 pt-1.5 font-semibold">
                      <span className="text-fg">รวม / Total</span>
                      <span className="font-score text-accent">{formatTHB(pricingPreview.breakdown.total)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-fg-muted">
                    แต่ละการจองคือ<b>ผลรวมราคาต่อกริด</b> — เหมือนที่ลูกค้าเห็น / Each booking is the sum of per-grid-unit
                    prices — mirrors what the client sees.
                  </p>
                </>
              ) : (
                <p className="text-xs text-fg-muted">
                  เปิดวันอย่างน้อยหนึ่งวันเพื่อดูตัวอย่างราคา / Open at least one day to see a pricing preview.
                </p>
              )}
            </CardContent>
          </Card>

          {isEdit && (
            <div className="flex gap-2.5 rounded-card border border-line-100 bg-surface-2 p-3 text-xs text-fg-muted">
              <span aria-hidden>🛠️</span>
              <p>
                <b className="text-fg">ปิดปรับปรุงสนาม / Maintenance block</b> แยกต่างหากจากการปิดใช้งานสนาม — ปิดเฉพาะวัน/เวลาที่
                เลือกโดยยังเปิดให้จองช่วงอื่นได้ / is separate from deactivating: block specific dates/times while keeping
                the court bookable otherwise.{' '}
                <a href="#court-blocks" className="font-medium text-accent hover:underline">
                  จัดการช่วงปิด / Add block →
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      {!hideInlineActions && (
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึก / Save' : 'สร้างสนาม / Create court'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/admin/catalog/courts')}>
            ยกเลิก / Cancel
          </Button>
        </div>
      )}
    </form>
  );
}

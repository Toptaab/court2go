'use client';

import { useEffect, useState } from 'react';
import { GRID_INTERVAL_MINUTES, type Config, type GridIntervalMinutes } from '@repo/types';
import { useAdminConfig, useUpdateConfig } from '@/lib/hooks/use-admin-settings';
import { messageForError } from '@/lib/error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

/**
 * Tenant Config editor (Design D14, PRD A8.1) — a full-replace singleton:
 * `GET /admin/config` loads the current object, every field is editable,
 * and `PUT /admin/config` sends the WHOLE object back (there's no PATCH —
 * `useUpdateConfig`'s own doc comment repeats this). `configForm` state is
 * only initialized once the GET resolves (`useEffect` below), so a stale
 * default is never accidentally PUT before the real values are known.
 */
export default function AdminConfigPage() {
  const { data: config, isLoading, isError } = useAdminConfig();
  const [form, setForm] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updateConfig = useUpdateConfig();

  useEffect(() => {
    if (config && !form) setForm(config);
  }, [config, form]);

  const handleSubmit = async () => {
    if (!form) return;
    setError(null);
    try {
      await updateConfig.mutateAsync(form);
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const setField = <K extends keyof Config>(key: K, value: Config[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">ตั้งค่าระบบ / System config</h1>
        <p className="text-xs text-fg-muted">ค่าเริ่มต้นของ OTP, การจอง และ session / OTP, booking, and session defaults.</p>
      </div>

      {isLoading && <div className="h-96 animate-pulse rounded-card bg-surface-2" />}
      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load config.</p>
      )}

      {form && (
        <>
          {error && (
            <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
              <p className="text-sm text-status-danger">{error}</p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">การจับจอง / Hold &amp; session</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-hold-window">ระยะเวลาจับจอง (นาที) / Hold window (min)</Label>
                <Select
                  id="cfg-hold-window"
                  value={form.holdWindowMinutes}
                  onChange={(e) => setField('holdWindowMinutes', Number(e.target.value) as 5 | 10)}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-session-days">ระยะเวลา session (วัน) / Session duration (days)</Label>
                <Input
                  id="cfg-session-days"
                  type="number"
                  min={1}
                  max={365}
                  value={form.clientSessionDurationDays}
                  onChange={(e) => setField('clientSessionDurationDays', Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">OTP</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-otp-expiry">หมดอายุ (นาที) / Expiry (min)</Label>
                <Input
                  id="cfg-otp-expiry"
                  type="number"
                  min={1}
                  max={30}
                  value={form.otpExpiryMinutes}
                  onChange={(e) => setField('otpExpiryMinutes', Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-otp-attempts">จำนวนครั้งสูงสุด / Max attempts</Label>
                <Input
                  id="cfg-otp-attempts"
                  type="number"
                  min={1}
                  max={10}
                  value={form.otpMaxAttempts}
                  onChange={(e) => setField('otpMaxAttempts', Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-otp-cooldown">รอส่งใหม่ (วินาที) / Resend cooldown (sec)</Label>
                <Input
                  id="cfg-otp-cooldown"
                  type="number"
                  min={0}
                  max={600}
                  value={form.otpResendCooldownSeconds}
                  onChange={(e) => setField('otpResendCooldownSeconds', Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-otp-max-sends">ส่งได้สูงสุด/ชม. / Max sends/hour</Label>
                <Input
                  id="cfg-otp-max-sends"
                  type="number"
                  min={1}
                  max={50}
                  value={form.otpMaxSendsPerHour}
                  onChange={(e) => setField('otpMaxSendsPerHour', Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">กฎการจอง / Booking rules</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-lead-time">เวลาล่วงหน้าขั้นต่ำ (นาที) / Min lead time (min)</Label>
                <Input
                  id="cfg-lead-time"
                  type="number"
                  min={0}
                  value={form.minBookingLeadTimeMinutes}
                  onChange={(e) => setField('minBookingLeadTimeMinutes', Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-advance-days">จองล่วงหน้าสูงสุด (วัน) / Max advance (days)</Label>
                <Input
                  id="cfg-advance-days"
                  type="number"
                  min={1}
                  max={365}
                  value={form.maxAdvanceBookingDays}
                  onChange={(e) => setField('maxAdvanceBookingDays', Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-cutoff">เวลาตัดยกเลิก (ชม.) / Cancellation cutoff (hrs)</Label>
                <Input
                  id="cfg-cutoff"
                  type="number"
                  min={0}
                  value={form.cancellationCutoffHours}
                  onChange={(e) => setField('cancellationCutoffHours', Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">ค่าเริ่มต้นสนาม / Court defaults</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-grid-interval">ช่วงเวลาต่อกริด (นาที) / Grid interval (min)</Label>
                <Select
                  id="cfg-grid-interval"
                  value={form.defaultGridIntervalMinutes}
                  onChange={(e) =>
                    setField('defaultGridIntervalMinutes', Number(e.target.value) as GridIntervalMinutes)
                  }
                >
                  {GRID_INTERVAL_MINUTES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cfg-max-slots">จำนวนช่องสูงสุด / Max slots</Label>
                <Input
                  id="cfg-max-slots"
                  type="number"
                  min={1}
                  value={form.defaultMaxSlots}
                  onChange={(e) => setField('defaultMaxSlots', Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="button" variant="primary" disabled={updateConfig.isPending} onClick={handleSubmit}>
              {updateConfig.isPending ? 'กำลังบันทึก...' : 'บันทึก / Save'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

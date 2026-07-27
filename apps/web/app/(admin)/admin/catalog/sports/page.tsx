'use client';

import { useState } from 'react';
import type { Sport } from '@repo/types';
import { upsertSportBodySchema } from '@repo/types';
import {
  useAdminSports,
  useCreateSport,
  useUpdateSport,
  useDeactivateSport,
  useDeleteSport,
} from '@/lib/hooks/use-admin-catalog';
import { messageForError } from '@/lib/error';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * Sport list (PRD A3.1) — simple Tenant-level catalog (no dedicated Design
 * ID). Inline create + inline rename, per the M10.9 brief ("simple list +
 * inline create/rename"); no separate `/new` or `/[id]` route needed since
 * a Sport is just a name.
 */
export default function AdminSportsPage() {
  const { data: sports, isLoading, isError } = useAdminSports();
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const createSport = useCreateSport();

  const handleCreate = async () => {
    setCreateError(null);
    const parsed = upsertSportBodySchema.safeParse({ name: newName.trim() });
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? 'กรุณากรอกชื่อกีฬา / Please enter a name.');
      return;
    }
    try {
      await createSport.mutateAsync(parsed.data);
      setNewName('');
    } catch (err) {
      setCreateError(messageForError(err));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">กีฬา / Sports</h1>
        <p className="text-xs text-fg-muted">ประเภทกิจกรรมที่เปิดให้จอง / Activity types available for booking.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="new-sport-name" className="text-xs font-medium text-fg">
              ชื่อกีฬาใหม่ / New sport name
            </label>
            <Input
              id="new-sport-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="เช่น แบดมินตัน / e.g. Badminton"
            />
          </div>
          <Button type="button" variant="primary" size="sm" disabled={createSport.isPending} onClick={handleCreate}>
            {createSport.isPending ? 'กำลังเพิ่ม...' : '+ เพิ่ม / Add'}
          </Button>
        </CardContent>
      </Card>
      {createError && <p className="text-xs text-status-danger">{createError}</p>}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-card bg-surface-2" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load sports.</p>
      )}

      {sports && sports.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">ยังไม่มีกีฬา / No sports yet.</p>
      )}

      {sports?.map((sport) => <SportRow key={sport.id} sport={sport} />)}
    </div>
  );
}

function SportRow({ sport }: { sport: Sport }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sport.name);
  const [error, setError] = useState<string | null>(null);

  const updateSport = useUpdateSport(sport.id);
  const deactivate = useDeactivateSport(sport.id);
  const softDelete = useDeleteSport(sport.id);

  const handleRename = async () => {
    setError(null);
    const parsed = upsertSportBodySchema.safeParse({ name: name.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณากรอกชื่อกีฬา / Please enter a name.');
      return;
    }
    try {
      await updateSport.mutateAsync(parsed.data);
      setEditing(false);
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleDeactivate = async () => {
    setError(null);
    try {
      await deactivate.mutateAsync();
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const handleSoftDelete = async () => {
    setError(null);
    try {
      await softDelete.mutateAsync();
    } catch (err) {
      setError(messageForError(err));
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editing ? (
            <div className="flex flex-1 items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
              <Button variant="primary" size="sm" disabled={updateSport.isPending} onClick={handleRename}>
                {updateSport.isPending ? 'กำลังบันทึก...' : 'บันทึก / Save'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setName(sport.name);
                  setError(null);
                }}
              >
                ยกเลิก / Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">{sport.name}</span>
              {!sport.isActive && <Badge variant="neutral">ปิดใช้งาน / Inactive</Badge>}
            </div>
          )}

          {!editing && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                แก้ไขชื่อ / Rename
              </Button>
              {sport.isActive && (
                <Button variant="secondary" size="sm" disabled={deactivate.isPending} onClick={handleDeactivate}>
                  {deactivate.isPending ? 'กำลังปิดใช้งาน...' : 'ปิดใช้งาน / Deactivate'}
                </Button>
              )}
              <Button variant="destructive" size="sm" disabled={softDelete.isPending} onClick={handleSoftDelete}>
                {softDelete.isPending ? 'กำลังลบ...' : 'ลบ / Delete'}
              </Button>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-status-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}

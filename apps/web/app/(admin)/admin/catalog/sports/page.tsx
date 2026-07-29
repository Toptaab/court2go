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
import { SimpleTable, type DataTableColumn } from '@/components/ui/paginated-list';

/**
 * Sport list (PRD A3.1) — simple Tenant-level catalog (no dedicated Design
 * ID). Inline create + inline rename, per the M10.9 brief ("simple list +
 * inline create/rename"); no separate `/new` or `/[id]` route needed since
 * a Sport is just a name. Rename-edit state is lifted to the page (one
 * sport editable at a time) so it can be shared across the Name and
 * Actions table columns.
 */
export default function AdminSportsPage() {
  const { data: sports, isLoading, isError } = useAdminSports();
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const createSport = useCreateSport();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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

  const columns: DataTableColumn<Sport>[] = [
    {
      header: 'Sport',
      cell: (sport) =>
        editingId === sport.id ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="max-w-xs"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-fg">{sport.name}</span>
            {!sport.isActive && <Badge variant="neutral">ปิดใช้งาน / Inactive</Badge>}
          </div>
        ),
    },
    {
      header: 'Actions',
      cell: (sport) => (
        <SportActions
          sport={sport}
          editing={editingId === sport.id}
          editName={editName}
          onStartEdit={() => { setEditingId(sport.id); setEditName(sport.name); }}
          onCancelEdit={() => setEditingId(null)}
          onRenamed={() => setEditingId(null)}
        />
      ),
    },
  ];

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

      <SimpleTable
        items={sports}
        isLoading={isLoading}
        isError={isError}
        columns={columns}
        keyOf={(sport) => sport.id}
        emptyMessage="ยังไม่มีกีฬา / No sports yet."
        errorMessage="เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load sports."
        skeletonCount={3}
        skeletonClassName="h-14"
      />
    </div>
  );
}

function SportActions({
  sport,
  editing,
  editName,
  onStartEdit,
  onCancelEdit,
  onRenamed,
}: {
  sport: Sport;
  editing: boolean;
  editName: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onRenamed: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const updateSport = useUpdateSport(sport.id);
  const deactivate = useDeactivateSport(sport.id);
  const softDelete = useDeleteSport(sport.id);

  const handleRename = async () => {
    setError(null);
    const parsed = upsertSportBodySchema.safeParse({ name: editName.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'กรุณากรอกชื่อกีฬา / Please enter a name.');
      return;
    }
    try {
      await updateSport.mutateAsync(parsed.data);
      onRenamed();
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
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button variant="primary" size="sm" disabled={updateSport.isPending} onClick={handleRename}>
              {updateSport.isPending ? 'กำลังบันทึก...' : 'บันทึก / Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { onCancelEdit(); setError(null); }}>
              ยกเลิก / Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onStartEdit}>
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
          </>
        )}
      </div>
      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { hexColorSchema } from '@repo/types';
import { useAdminBranding, useUpdateBranding } from '@/lib/hooks/use-admin-settings';
import { messageForError } from '@/lib/error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImageUploadField } from '@/components/admin/image-upload-field';

const DEFAULT_COLOR = '#2563eb';

/**
 * Tenant Branding editor (Design D15, PRD A8.2) — logo + accent color(s).
 * Same full-replace-singleton shape as the Config page: `PUT
 * /admin/branding` sends the whole `Branding` object.
 */
export default function AdminBrandingPage() {
  const { data: branding, isLoading, isError } = useAdminBranding();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const [secondaryColor, setSecondaryColor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateBranding = useUpdateBranding();

  useEffect(() => {
    if (branding && !loaded) {
      setLogoUrl(branding.logoUrl);
      setPrimaryColor(branding.primaryColor);
      setSecondaryColor(branding.secondaryColor);
      setLoaded(true);
    }
  }, [branding, loaded]);

  const handleSubmit = async () => {
    setError(null);
    const draft: unknown = { logoUrl, primaryColor, secondaryColor };
    try {
      await updateBranding.mutateAsync(draft as { logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null });
    } catch (err) {
      setError(messageForError(err));
    }
  };

  const validPrimary = primaryColor === null || hexColorSchema.safeParse(primaryColor).success;
  const validSecondary = secondaryColor === null || hexColorSchema.safeParse(secondaryColor).success;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">แบรนด์ / Branding</h1>
        <p className="text-xs text-fg-muted">โลโก้และสีประจำสถานที่ให้บริการ / Venue logo and CI colors.</p>
      </div>

      {isLoading && <div className="h-64 animate-pulse rounded-card bg-surface-2" />}
      {isError && (
        <p className="text-sm text-status-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load branding.</p>
      )}

      {loaded && (
        <>
          {error && (
            <div className="rounded-card border border-status-danger/20 bg-status-danger/5 px-3 py-2">
              <p className="text-sm text-status-danger">{error}</p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">โลโก้ / Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUploadField purpose="LOGO" value={logoUrl} onUploaded={setLogoUrl} label="โลโก้สถานที่ให้บริการ / Venue logo" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">สี CI / CI colors</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand-primary">สีหลัก / Primary color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="brand-primary"
                    type="color"
                    value={primaryColor ?? DEFAULT_COLOR}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 rounded-card border border-line-300 bg-surface"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setPrimaryColor(null)}>
                    ล้างค่า / Clear
                  </Button>
                </div>
                {!validPrimary && <p className="text-xs text-status-danger">รูปแบบสีไม่ถูกต้อง / Invalid color format.</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="brand-secondary">สีรอง (ไม่บังคับ) / Secondary color (optional)</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="brand-secondary"
                    type="color"
                    value={secondaryColor ?? DEFAULT_COLOR}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-14 rounded-card border border-line-300 bg-surface"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setSecondaryColor(null)}>
                    ล้างค่า / Clear
                  </Button>
                </div>
                {!validSecondary && <p className="text-xs text-status-danger">รูปแบบสีไม่ถูกต้อง / Invalid color format.</p>}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={updateBranding.isPending || !validPrimary || !validSecondary}
              onClick={handleSubmit}
            >
              {updateBranding.isPending ? 'กำลังบันทึก...' : 'บันทึก / Save'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

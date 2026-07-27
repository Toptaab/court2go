'use client';

import { useRef, useState } from 'react';
import type { ImageUploadUrlBody } from '@repo/types';
import { useImageUploadUrl } from '@/lib/hooks/use-admin-settings';
import { messageForError } from '@/lib/error';
import { Button } from '@/components/ui/button';

/** Mirrors `imageUploadUrlBodySchema`'s `contentType` enum exactly — do not widen. */
const ACCEPTED_CONTENT_TYPES: ImageUploadUrlBody['contentType'][] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
];

interface ImageUploadFieldProps {
  purpose: ImageUploadUrlBody['purpose'];
  /** Current public URL, if any (edit screens) — shown as the preview until replaced. */
  value: string | null;
  onUploaded: (publicUrl: string) => void;
  label: string;
}

/**
 * Reusable presigned-PUT image picker (M10.10) — LOGO (Branding, D15) and
 * NEWS (News editor, D13) share this exact flow:
 *   1. POST /admin/uploads/image-url ({ purpose, contentType, contentLength })
 *      -> { uploadUrl, publicUrl, requiredHeaders, expiresAt }
 *   2. PUT the file straight to `uploadUrl` with EXACTLY `requiredHeaders`
 *      (never fewer/more — object storage will reject a header mismatch).
 *   3. On success, hand the caller the server-derived `publicUrl` — never a
 *      client-fabricated URL — via `onUploaded`.
 *
 * Mirrors `use-payment.ts`'s slip-upload pattern (POST-for-url -> PUT), but
 * for the PUBLIC-read image bucket rather than the private slip bucket.
 */
export function ImageUploadField({ purpose, value, onUploaded, label }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const requestUploadUrl = useImageUploadUrl();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setError(null);

    if (!ACCEPTED_CONTENT_TYPES.includes(file.type as ImageUploadUrlBody['contentType'])) {
      setError('ชนิดไฟล์ไม่รองรับ (jpeg/png/webp/svg) / Unsupported file type (jpeg/png/webp/svg).');
      return;
    }

    setUploading(true);
    try {
      const { uploadUrl, publicUrl, requiredHeaders } = await requestUploadUrl.mutateAsync({
        purpose,
        contentType: file.type as ImageUploadUrlBody['contentType'],
        contentLength: file.size,
      });

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: requiredHeaders,
        body: file,
      });
      if (!putRes.ok) {
        throw new Error('Upload failed');
      }

      onUploaded(publicUrl);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-fg">{label}</span>

      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- external public-storage URL, not a static asset
        <img
          src={value}
          alt={label}
          className="h-32 w-32 rounded-card border border-line-100 object-contain"
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_CONTENT_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'กำลังอัปโหลด...' : value ? 'เปลี่ยนรูป / Change image' : 'อัปโหลดรูป / Upload image'}
      </Button>

      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  );
}

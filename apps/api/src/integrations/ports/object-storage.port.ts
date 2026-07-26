/**
 * ObjectStorage port (ARCHITECTURE §4.4). Slip images are uploaded via a
 * short-lived presigned PUT URL issued directly to the client (binary never
 * proxied through the API), stored under a private
 * `tenants/{tenantId}/slips/{bookingId}/{uuid}` key, and served to Admins/the
 * owning Member only via short-lived signed GET URLs generated on demand —
 * never a public URL (NFR5c). Logos/news images use the same adapter but
 * public-read `tenants/{tenantId}/public/...` keys (out of scope here).
 *
 * Bound to a concrete adapter (`LocalObjectStorageAdapter` for MVP/dev; a
 * real S3/R2-compatible adapter later) via the `OBJECT_STORAGE` DI token in
 * `IntegrationsModule` — no consumer (`PaymentService`) ever changes.
 */
export interface ObjectStorage {
  createPresignedPutUrl(input: {
    objectKey: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<{ uploadUrl: string; requiredHeaders: Record<string, string>; expiresAt: Date }>;

  createSignedGetUrl(input: {
    objectKey: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: Date }>;
}

export const OBJECT_STORAGE = Symbol('ObjectStorage');

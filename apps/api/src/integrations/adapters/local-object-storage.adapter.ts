import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ObjectStorage } from '../ports/object-storage.port';

/**
 * LocalObjectStorageAdapter (ARCHITECTURE §4.4, §9) — the MVP `ObjectStorage`
 * implementation. No real S3/R2 account is required to build/demo MVP: it
 * returns plausible-shaped URLs (`https://storage.local/<objectKey>?sig=...
 * &expires=...`) and never performs any actual network I/O or persists any
 * bytes — the "upload"/"download" is purely a URL-shape contract for the
 * client/admin console to exercise against in dev.
 *
 * Deterministic signature (sha256 of `objectKey:expiresAtEpochMs`, truncated)
 * so the same call with the same clock instant is reproducible in tests —
 * NOT a real HMAC/security mechanism. Swapping in a real S3-compatible
 * adapter is one new class + one line in `IntegrationsModule`'s provider
 * factory (`OBJECT_STORAGE_PROVIDER=s3`) — no consumer (`PaymentService`)
 * ever changes, because it only depends on the `ObjectStorage` port.
 */
@Injectable()
export class LocalObjectStorageAdapter implements ObjectStorage {
  async createPresignedPutUrl(input: {
    objectKey: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<{ uploadUrl: string; requiredHeaders: Record<string, string>; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    return {
      uploadUrl: this.buildUrl(input.objectKey, expiresAt),
      requiredHeaders: {
        'Content-Type': input.contentType,
        'Content-Length': String(input.contentLength),
      },
      expiresAt,
    };
  }

  async createSignedGetUrl(input: {
    objectKey: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    return { url: this.buildUrl(input.objectKey, expiresAt), expiresAt };
  }

  private buildUrl(objectKey: string, expiresAt: Date): string {
    const sig = createHash('sha256').update(`${objectKey}:${expiresAt.getTime()}`).digest('hex').slice(0, 32);
    return `https://storage.local/${objectKey}?sig=${sig}&expires=${expiresAt.getTime()}`;
  }
}

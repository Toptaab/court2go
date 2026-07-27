import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  brandingSchema,
  configSchema,
  imageUploadUrlResponseSchema,
  type Branding,
  type Config,
  type ImageUploadUrlBody,
  type ImageUploadUrlResponse,
} from '@repo/types';
import type { AdminUser, Config as ConfigRow } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { getTenantId } from '../../prisma/tenant-context';
import { ConfigRepository } from '../config/config.repository';
import { TenantsRepository } from '../tenants/tenants.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { OBJECT_STORAGE, type ObjectStorage } from '../../integrations/ports/object-storage.port';
import { toBranding } from '../public/catalog.mappers';

/** Max public image upload size (logo/news), mirroring the slip cap. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_UPLOAD_URL_TTL_SECONDS = 300;
const CONTENT_TYPE_EXT: Record<ImageUploadUrlBody['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function toConfig(c: ConfigRow): Config {
  return configSchema.parse({
    holdWindowMinutes: c.holdWindowMinutes,
    clientSessionDurationDays: c.clientSessionDurationDays,
    otpExpiryMinutes: c.otpExpiryMinutes,
    otpMaxAttempts: c.otpMaxAttempts,
    otpResendCooldownSeconds: c.otpResendCooldownSeconds,
    otpMaxSendsPerHour: c.otpMaxSendsPerHour,
    minBookingLeadTimeMinutes: c.minBookingLeadTimeMinutes,
    maxAdvanceBookingDays: c.maxAdvanceBookingDays,
    cancellationCutoffHours: c.cancellationCutoffHours,
    defaultGridIntervalMinutes: c.defaultGridIntervalMinutes,
    defaultMaxSlots: c.defaultMaxSlots,
  });
}

/**
 * Tenant configuration, branding, and public image uploads (PRD A8). Org-level
 * (Owner/Admin). Config is a full-replace PUT (1:1 with the Tenant). Branding
 * writes the plain columns on the Tenant row. Image uploads issue a presigned
 * PUT to a PUBLIC-read key; `publicUrl` is derived deterministically from that
 * key (the real S3/R2 binding is an M11 deploy concern).
 */
@Injectable()
export class AdminConfigService {
  constructor(
    private readonly config: ConfigRepository,
    private readonly tenants: TenantsRepository,
    private readonly audit: AuditLogRepository,
    @Inject(OBJECT_STORAGE) private readonly objectStorage: ObjectStorage,
  ) {}

  async getConfig(): Promise<Config> {
    const row = await this.config.get();
    if (!row) throw ApiError.notFound('Config not found');
    return toConfig(row);
  }

  async updateConfig(admin: AdminUser, body: Config): Promise<Config> {
    const row = await this.config.update({
      holdWindowMinutes: body.holdWindowMinutes,
      clientSessionDurationDays: body.clientSessionDurationDays,
      otpExpiryMinutes: body.otpExpiryMinutes,
      otpMaxAttempts: body.otpMaxAttempts,
      otpResendCooldownSeconds: body.otpResendCooldownSeconds,
      otpMaxSendsPerHour: body.otpMaxSendsPerHour,
      minBookingLeadTimeMinutes: body.minBookingLeadTimeMinutes,
      maxAdvanceBookingDays: body.maxAdvanceBookingDays,
      cancellationCutoffHours: body.cancellationCutoffHours,
      defaultGridIntervalMinutes: body.defaultGridIntervalMinutes,
      defaultMaxSlots: body.defaultMaxSlots,
    });
    await this.audit.record({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: 'CONFIG_UPDATED',
      entityType: 'Config',
      entityId: row.id,
    });
    return toConfig(row);
  }

  async getBranding(): Promise<Branding> {
    const tenant = await this.tenants.findById(getTenantId());
    if (!tenant) throw ApiError.notFound('Tenant not found');
    return toBranding(tenant);
  }

  async updateBranding(admin: AdminUser, body: Branding): Promise<Branding> {
    const tenantId = getTenantId();
    const tenant = await this.tenants.updateBranding(tenantId, {
      logoUrl: body.logoUrl,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
    });
    await this.audit.record({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: 'BRANDING_UPDATED',
      entityType: 'Tenant',
      entityId: tenantId,
    });
    return brandingSchema.parse(toBranding(tenant));
  }

  async createImageUploadUrl(body: ImageUploadUrlBody): Promise<ImageUploadUrlResponse> {
    if (body.contentLength > MAX_IMAGE_BYTES) {
      throw ApiError.validation('Image exceeds the maximum allowed size', {
        fieldErrors: { contentLength: [`must be <= ${MAX_IMAGE_BYTES} bytes`] },
      });
    }
    const tenantId = getTenantId();
    const ext = CONTENT_TYPE_EXT[body.contentType];
    // Public-read key namespace (ARCHITECTURE §4.4) — distinct from private slips.
    const objectKey = `tenants/${tenantId}/public/${body.purpose.toLowerCase()}/${randomUUID()}.${ext}`;

    const signed = await this.objectStorage.createPresignedPutUrl({
      objectKey,
      contentType: body.contentType,
      contentLength: body.contentLength,
      expiresInSeconds: IMAGE_UPLOAD_URL_TTL_SECONDS,
    });

    const base = (process.env.PUBLIC_ASSET_BASE_URL ?? 'https://storage.local').replace(/\/$/, '');
    return imageUploadUrlResponseSchema.parse({
      uploadUrl: signed.uploadUrl,
      publicUrl: `${base}/${objectKey}`,
      requiredHeaders: signed.requiredHeaders,
      expiresAt: signed.expiresAt.toISOString(),
    });
  }
}

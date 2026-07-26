import { z } from 'zod';
import { idSchema, isoDateTimeSchema, urlSchema } from '../common/index';
import { newsStatusSchema } from '../enums/index';

/**
 * News / Announcement (PRD §4, A10, C0). Tenant-scoped content on the public
 * News Feed (default landing). Only PUBLISHED posts appear publicly.
 */
export const newsSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(200),
  body: z.string().max(10000),
  imageUrl: urlSchema.nullable(),
  status: newsStatusSchema,
  /** When it went (or is scheduled to go) public; null while draft. */
  publishedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type News = z.infer<typeof newsSchema>;

/** Public feed item — PUBLISHED only, no draft/admin fields (PRD C0.1). */
export const publicNewsSchema = z.object({
  id: idSchema,
  title: z.string(),
  body: z.string(),
  imageUrl: urlSchema.nullable(),
  publishedAt: isoDateTimeSchema,
});
export type PublicNews = z.infer<typeof publicNewsSchema>;

import { Injectable } from '@nestjs/common';
import {
  newsSchema,
  paginated,
  type News as NewsDto,
  type PaginationQuery,
  type Paginated,
  type UpsertNewsBody,
} from '@repo/types';
import type { AdminUser, News } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { NewsRepository } from '../news/news.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';

function toNews(n: News): NewsDto {
  return newsSchema.parse({
    id: n.id,
    title: n.title,
    body: n.body,
    imageUrl: n.imageUrl,
    status: n.status,
    publishedAt: n.publishedAt ? n.publishedAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  });
}

/** Admin news / announcements (PRD A10). Org-level (Owner/Admin). */
@Injectable()
export class AdminNewsService {
  constructor(
    private readonly news: NewsRepository,
    private readonly audit: AuditLogRepository,
  ) {}

  async list(query: PaginationQuery): Promise<Paginated<NewsDto>> {
    const all = await this.news.listAdmin();
    const skip = (query.page - 1) * query.pageSize;
    const pageRows = all.slice(skip, skip + query.pageSize);
    return paginated(newsSchema).parse({
      items: pageRows.map(toNews),
      page: query.page,
      pageSize: query.pageSize,
      total: all.length,
      hasNextPage: skip + pageRows.length < all.length,
    });
  }

  async create(admin: AdminUser, body: UpsertNewsBody): Promise<NewsDto> {
    const created = await this.news.create({
      title: body.title,
      body: body.body,
      imageUrl: body.imageUrl ?? null,
      status: body.status,
    });
    await this.record(admin, 'NEWS_CREATED', created.id);
    return toNews(created);
  }

  async update(admin: AdminUser, id: string, body: UpsertNewsBody): Promise<NewsDto> {
    const existing = await this.news.findById(id);
    if (!existing) throw ApiError.notFound('News not found');
    const updated = await this.news.update(id, {
      title: body.title,
      body: body.body,
      imageUrl: body.imageUrl ?? null,
      status: body.status,
    });
    await this.record(admin, 'NEWS_UPDATED', id);
    return toNews(updated);
  }

  async remove(admin: AdminUser, id: string): Promise<void> {
    const existing = await this.news.findById(id);
    if (!existing) throw ApiError.notFound('News not found');
    await this.news.delete(id);
    await this.record(admin, 'NEWS_DELETED', id);
  }

  private record(admin: AdminUser, action: string, entityId: string) {
    return this.audit.record({ actorType: 'ADMIN', actorId: admin.id, action, entityType: 'News', entityId });
  }
}

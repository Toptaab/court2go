import { Injectable } from '@nestjs/common';
import { News } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantId } from '../../prisma/tenant-context';

/** News / Announcement (PRD §4, A10, C0). */
@Injectable()
export class NewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<News | null> {
    return this.prisma.withTenant((tx) => tx.news.findUnique({ where: { id } }));
  }

  /** Public feed (PRD C0.1) — PUBLISHED only, newest first. */
  listPublic(): Promise<News[]> {
    return this.prisma.withTenant((tx) =>
      tx.news.findMany({ where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' } }),
    );
  }

  listAdmin(): Promise<News[]> {
    return this.prisma.withTenant((tx) => tx.news.findMany({ orderBy: { createdAt: 'desc' } }));
  }

  create(data: { title: string; body: string; imageUrl: string | null; status: News['status'] }): Promise<News> {
    return this.prisma.withTenant((tx) =>
      tx.news.create({
        data: { tenantId: getTenantId(), ...data, publishedAt: data.status === 'PUBLISHED' ? new Date() : null },
      }),
    );
  }

  update(
    id: string,
    data: { title?: string; body?: string; imageUrl?: string | null; status?: News['status'] },
  ): Promise<News> {
    return this.prisma.withTenant((tx) =>
      tx.news.update({
        where: { id },
        data: {
          ...data,
          ...(data.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
          ...(data.status === 'DRAFT' ? { publishedAt: null } : {}),
        },
      }),
    );
  }

  delete(id: string): Promise<News> {
    return this.prisma.withTenant((tx) => tx.news.delete({ where: { id } }));
  }
}

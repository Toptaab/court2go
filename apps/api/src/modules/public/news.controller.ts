import { Controller, Get, Param, Query } from '@nestjs/common';
import { type PaginationQuery, type Paginated, type PublicNews, paginationQuerySchema } from '@repo/types';
import { ApiError } from '../../common/api-error';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { NewsRepository } from '../news/news.repository';
import { toPublicNews } from './catalog.mappers';

/** Public news feed (PRD C0.1) — PUBLISHED only, newest first, paginated. */
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsRepository) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery,
  ): Promise<Paginated<PublicNews>> {
    const all = await this.news.listPublic();
    const total = all.length;
    const start = (q.page - 1) * q.pageSize;
    const items = all.slice(start, start + q.pageSize).map(toPublicNews);
    return {
      items,
      page: q.page,
      pageSize: q.pageSize,
      total,
      hasNextPage: start + q.pageSize < total,
    };
  }

  @Get(':newsId')
  async getOne(@Param('newsId') newsId: string): Promise<PublicNews> {
    const item = await this.news.findById(newsId);
    if (!item || item.status !== 'PUBLISHED') {
      throw ApiError.notFound('News item not found');
    }
    return toPublicNews(item);
  }
}

import { Module } from '@nestjs/common';
import { BranchesRepository } from '../branches/branches.repository';
import { SportsRepository } from '../sports/sports.repository';
import { CourtsRepository } from '../courts/courts.repository';
import { NewsRepository } from '../news/news.repository';
import { ConfigRepository } from '../config/config.repository';
import { TenantsRepository } from '../tenants/tenants.repository';
import { CatalogController } from './catalog.controller';
import { NewsController } from './news.controller';
import { TenantController } from './tenant.controller';

/**
 * Public (unauthenticated) API surface: tenant bootstrap, catalog browse, news
 * feed (PRD C0–C1). All reads flow through the shared repositories → public
 * DTO mappers. Repositories are provided here (stateless) rather than shared
 * globally; auth/booking milestones will introduce their own modules reusing
 * the same repository classes.
 */
@Module({
  controllers: [TenantController, CatalogController, NewsController],
  providers: [
    BranchesRepository,
    SportsRepository,
    CourtsRepository,
    NewsRepository,
    ConfigRepository,
    TenantsRepository,
  ],
})
export class PublicModule {}

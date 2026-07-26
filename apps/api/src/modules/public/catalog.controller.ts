import { Controller, Get, Param } from '@nestjs/common';
import type { PublicBranch, PublicCourt, PublicSport } from '@repo/types';
import { ApiError } from '../../common/api-error';
import { BranchesRepository } from '../branches/branches.repository';
import { SportsRepository } from '../sports/sports.repository';
import { CourtsRepository } from '../courts/courts.repository';
import { toPublicBranch, toPublicCourt, toPublicSport } from './catalog.mappers';

/**
 * Public catalog (PRD C1.1) — the unauthenticated browse surface. Every route
 * is tenant-scoped via `x-tenant-id` (TenantContextMiddleware → RLS); only
 * active, non-deleted records are ever returned (enforced in the repositories'
 * `listPublic*` queries).
 */
@Controller()
export class CatalogController {
  constructor(
    private readonly branches: BranchesRepository,
    private readonly sports: SportsRepository,
    private readonly courts: CourtsRepository,
  ) {}

  @Get('branches')
  async listBranches(): Promise<PublicBranch[]> {
    return (await this.branches.listPublic()).map(toPublicBranch);
  }

  @Get('branches/:branchId/sports')
  async listSports(@Param('branchId') branchId: string): Promise<PublicSport[]> {
    return (await this.sports.listPublicForBranch(branchId)).map(toPublicSport);
  }

  @Get('branches/:branchId/sports/:sportId/courts')
  async listCourts(
    @Param('branchId') branchId: string,
    @Param('sportId') sportId: string,
  ): Promise<PublicCourt[]> {
    return (await this.courts.listPublicForBranchAndSport(branchId, sportId)).map(toPublicCourt);
  }

  @Get('courts/:courtId')
  async getCourt(@Param('courtId') courtId: string): Promise<PublicCourt> {
    const court = await this.courts.findById(courtId);
    // findById returns any court regardless of status; the public surface must
    // 404 an inactive/deleted one rather than leak it.
    if (!court || !court.isActive || court.deletedAt) {
      throw ApiError.notFound('Court not found');
    }
    return toPublicCourt(court);
  }
}

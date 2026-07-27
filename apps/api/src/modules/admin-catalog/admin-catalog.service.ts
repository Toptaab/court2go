import { Injectable } from '@nestjs/common';
import type {
  Branch as BranchDto,
  Court as CourtDto,
  CourtBlock as CourtBlockDto,
  CreateCourtBlockBody,
  LifecycleResult,
  Sport as SportDto,
  UpsertBranchBody,
  UpsertCourtBody,
  UpsertSportBody,
} from '@repo/types';
import type { AdminUser, Prisma } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { assertBranchScope } from '../auth-admin/branch-scope';
import { BranchesRepository } from '../branches/branches.repository';
import { SportsRepository } from '../sports/sports.repository';
import { CourtsRepository } from '../courts/courts.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import {
  toAdminBranch,
  toAdminCourt,
  toAdminCourtBlock,
  toAdminSport,
  toLifecycleResult,
} from './admin-catalog.mappers';

/** A far-future upper bound for "all blocks on this court" (the repo only
 * exposes a range query; the admin list wants every block). */
const BLOCK_LIST_RANGE_START = new Date('2000-01-01T00:00:00.000Z');
const BLOCK_LIST_RANGE_END = new Date('2100-01-01T00:00:00.000Z');

/**
 * Admin catalog CRUD (PRD A3/A4/A5). Branch & sport mutations are org-level
 * (Owner/Admin, enforced by `@Roles` on the controller); court + block
 * mutations are additionally branch-scoped so a Branch Admin only ever touches
 * their own branch's courts (`assertBranchScope`, 403 BRANCH_SCOPE_DENIED).
 * Soft-delete is blocked while future bookings exist (409). Audit on every
 * create/update/delete/deactivate.
 */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly branches: BranchesRepository,
    private readonly sports: SportsRepository,
    private readonly courts: CourtsRepository,
    private readonly audit: AuditLogRepository,
  ) {}

  /* ------------------------------------------------------------------ Branches */

  /** `view_all_branches` is BRANCH_ADMIN: false (roles-matrix, ADR-0005) — a
   * Branch Admin must only ever see their own branch's row (which also
   * carries `promptPayId`/`businessHours`/`paymentMethod`), never the whole
   * tenant's branch list. Owner/Admin remain tenant-wide. */
  async listBranches(admin: AdminUser): Promise<BranchDto[]> {
    const branchId = admin.role === 'BRANCH_ADMIN' ? (admin.branchId ?? '__no_branch__') : undefined;
    return (await this.branches.listAdmin({ branchId })).map(toAdminBranch);
  }

  async getBranch(admin: AdminUser, id: string): Promise<BranchDto> {
    const branch = await this.branches.findById(id);
    if (!branch) throw ApiError.notFound('Branch not found');
    // A Branch's own `id` IS the `branchId` other resources point at, so
    // scope against the loaded branch's id itself (403 BRANCH_SCOPE_DENIED
    // for a Branch Admin reading another branch's full record).
    assertBranchScope(admin, branch.id);
    return toAdminBranch(branch);
  }

  async createBranch(admin: AdminUser, body: UpsertBranchBody): Promise<BranchDto> {
    const branch = await this.branches.create({
      name: body.name,
      address: body.address,
      paymentMethod: body.paymentMethod,
      promptPayId: body.promptPayId,
      businessHours: body.businessHours as unknown as Prisma.InputJsonValue,
    });
    await this.record(admin, 'BRANCH_CREATED', 'Branch', branch.id);
    return toAdminBranch(branch);
  }

  async updateBranch(admin: AdminUser, id: string, body: UpsertBranchBody): Promise<BranchDto> {
    const existing = await this.branches.findById(id);
    if (!existing) throw ApiError.notFound('Branch not found');
    const branch = await this.branches.update(id, {
      name: body.name,
      address: body.address,
      paymentMethod: body.paymentMethod,
      promptPayId: body.promptPayId,
      businessHours: body.businessHours as unknown as Prisma.InputJsonValue,
    });
    await this.record(admin, 'BRANCH_UPDATED', 'Branch', id);
    return toAdminBranch(branch);
  }

  async deleteBranch(admin: AdminUser, id: string): Promise<LifecycleResult> {
    const existing = await this.branches.findById(id);
    if (!existing) throw ApiError.notFound('Branch not found');
    if (await this.branches.hasFutureBookings(id)) {
      throw ApiError.conflict('SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS', 'Branch has upcoming bookings and cannot be deleted');
    }
    const branch = await this.branches.softDelete(id);
    await this.record(admin, 'BRANCH_DELETED', 'Branch', id);
    return toLifecycleResult(branch);
  }

  async deactivateBranch(admin: AdminUser, id: string): Promise<LifecycleResult> {
    const existing = await this.branches.findById(id);
    if (!existing) throw ApiError.notFound('Branch not found');
    const branch = await this.branches.setActive(id, false);
    await this.record(admin, 'BRANCH_DEACTIVATED', 'Branch', id);
    return toLifecycleResult(branch);
  }

  /* ------------------------------------------------------------------ Sports */

  async listSports(): Promise<SportDto[]> {
    return (await this.sports.listAdmin()).map(toAdminSport);
  }

  async createSport(admin: AdminUser, body: UpsertSportBody): Promise<SportDto> {
    const sport = await this.sports.create(body.name);
    await this.record(admin, 'SPORT_CREATED', 'Sport', sport.id);
    return toAdminSport(sport);
  }

  async updateSport(admin: AdminUser, id: string, body: UpsertSportBody): Promise<SportDto> {
    const existing = await this.sports.findById(id);
    if (!existing) throw ApiError.notFound('Sport not found');
    const sport = await this.sports.update(id, body.name);
    await this.record(admin, 'SPORT_UPDATED', 'Sport', id);
    return toAdminSport(sport);
  }

  async deleteSport(admin: AdminUser, id: string): Promise<LifecycleResult> {
    const existing = await this.sports.findById(id);
    if (!existing) throw ApiError.notFound('Sport not found');
    if (await this.sports.hasFutureBookings(id)) {
      throw ApiError.conflict('SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS', 'Sport has upcoming bookings and cannot be deleted');
    }
    const sport = await this.sports.softDelete(id);
    await this.record(admin, 'SPORT_DELETED', 'Sport', id);
    return toLifecycleResult(sport);
  }

  async deactivateSport(admin: AdminUser, id: string): Promise<LifecycleResult> {
    const existing = await this.sports.findById(id);
    if (!existing) throw ApiError.notFound('Sport not found');
    const sport = await this.sports.setActive(id, false);
    await this.record(admin, 'SPORT_DEACTIVATED', 'Sport', id);
    return toLifecycleResult(sport);
  }

  /* ------------------------------------------------------------------ Courts */

  async listCourts(admin: AdminUser, branchId?: string): Promise<CourtDto[]> {
    const scoped = admin.role === 'BRANCH_ADMIN' ? (admin.branchId ?? '__no_branch__') : branchId;
    const rows = await this.courts.listAdmin({ branchId: scoped });
    return rows.map(toAdminCourt);
  }

  async getCourt(admin: AdminUser, id: string): Promise<CourtDto> {
    const court = await this.loadScopedCourt(admin, id);
    return toAdminCourt(court);
  }

  async createCourt(admin: AdminUser, body: UpsertCourtBody): Promise<CourtDto> {
    assertBranchScope(admin, body.branchId);
    const created = await this.courts.create({
      branchId: body.branchId,
      sportId: body.sportId,
      name: body.name,
      gridIntervalMinutes: body.gridIntervalMinutes,
      maxSlots: body.maxSlots,
      basePricePerGridUnit: body.basePricePerGridUnit,
      schedule: body.schedule.map((d) => ({ ...d })),
      peakTimeRanges: body.peakTimeRanges.map((p) => ({ ...p, label: p.label ?? null })),
    });
    // Re-fetch with relations for the full DTO (create() returns the bare row).
    const court = await this.courts.findById(created.id);
    if (!court) throw ApiError.notFound('Court not found');
    await this.record(admin, 'COURT_CREATED', 'Court', court.id);
    return toAdminCourt(court);
  }

  async updateCourt(admin: AdminUser, id: string, body: UpsertCourtBody): Promise<CourtDto> {
    await this.loadScopedCourt(admin, id);
    // A move to a different branch must also be within scope.
    assertBranchScope(admin, body.branchId);
    await this.courts.update(id, {
      name: body.name,
      gridIntervalMinutes: body.gridIntervalMinutes,
      maxSlots: body.maxSlots,
      basePricePerGridUnit: body.basePricePerGridUnit,
      schedule: body.schedule.map((d) => ({ ...d })),
      peakTimeRanges: body.peakTimeRanges.map((p) => ({ ...p, label: p.label ?? null })),
    });
    const court = await this.courts.findById(id);
    if (!court) throw ApiError.notFound('Court not found');
    await this.record(admin, 'COURT_UPDATED', 'Court', id);
    return toAdminCourt(court);
  }

  async deleteCourt(admin: AdminUser, id: string): Promise<LifecycleResult> {
    await this.loadScopedCourt(admin, id);
    if (await this.courts.hasFutureBookings(id)) {
      throw ApiError.conflict('SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS', 'Court has upcoming bookings and cannot be deleted');
    }
    const court = await this.courts.softDelete(id);
    await this.record(admin, 'COURT_DELETED', 'Court', id);
    return toLifecycleResult(court);
  }

  async deactivateCourt(admin: AdminUser, id: string): Promise<LifecycleResult> {
    await this.loadScopedCourt(admin, id);
    const court = await this.courts.setActive(id, false);
    await this.record(admin, 'COURT_DEACTIVATED', 'Court', id);
    return toLifecycleResult(court);
  }

  /* ------------------------------------------------------------------ Court blocks */

  async listBlocks(admin: AdminUser, courtId: string): Promise<CourtBlockDto[]> {
    await this.loadScopedCourt(admin, courtId);
    const blocks = await this.courts.listBlocksInRange(courtId, BLOCK_LIST_RANGE_START, BLOCK_LIST_RANGE_END);
    return blocks.map(toAdminCourtBlock);
  }

  async createBlock(admin: AdminUser, courtId: string, body: CreateCourtBlockBody): Promise<CourtBlockDto> {
    await this.loadScopedCourt(admin, courtId);
    const block = await this.courts.createBlock(courtId, {
      reason: body.reason ?? null,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    });
    await this.record(admin, 'COURT_BLOCK_CREATED', 'CourtBlock', block.id);
    return toAdminCourtBlock(block);
  }

  async deleteBlock(admin: AdminUser, courtId: string, blockId: string): Promise<void> {
    await this.loadScopedCourt(admin, courtId);
    // Branch scope was only checked against `courtId` above — the block
    // itself must also be verified as belonging to THAT court before it's
    // deleted, otherwise a caller could pass a courtId they own alongside a
    // blockId from a different branch's court (IDOR). Fail closed to 404
    // rather than assume the deleteMany's affected-row count of 0 means
    // anything other than "not found in scope".
    const deleted = await this.courts.deleteBlockScoped(blockId, courtId);
    if (deleted === 0) throw ApiError.notFound('Block not found');
    await this.record(admin, 'COURT_BLOCK_DELETED', 'CourtBlock', blockId);
  }

  /* ------------------------------------------------------------------ helpers */

  private async loadScopedCourt(admin: AdminUser, id: string) {
    const court = await this.courts.findById(id);
    if (!court) throw ApiError.notFound('Court not found');
    assertBranchScope(admin, court.branchId);
    return court;
  }

  private record(admin: AdminUser, action: string, entityType: string, entityId: string) {
    return this.audit.record({ actorType: 'ADMIN', actorId: admin.id, action, entityType, entityId });
  }
}

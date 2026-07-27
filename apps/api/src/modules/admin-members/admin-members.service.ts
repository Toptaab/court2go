import { Injectable } from '@nestjs/common';
import {
  bookingListItemSchema,
  memberAdminViewSchema,
  paginated,
  type AdminBlockMemberBody,
  type AdminMemberListQuery,
  type BookingListItem,
  type MemberAdminView,
  type Paginated,
  type PaginationQuery,
} from '@repo/types';
import type { AdminUser, Member } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { MembersRepository } from '../members/members.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { ClientSessionsRepository } from '../auth-member/client-sessions.repository';
import { mapToBookingListItem } from '../bookings/booking.mapper';

/**
 * Admin Member Management (PRD A7). All routes are branch-aware: Owner/Admin
 * see every member; a Branch Admin sees only members with a booking at their
 * own branch, and their aggregates (`bookingCount`/`lastBookingAt`) are scoped
 * to that branch. Blocking revokes the member's live sessions immediately
 * (ADR-0005), so a blocked member cannot complete an in-flight booking.
 */
@Injectable()
export class AdminMembersService {
  constructor(
    private readonly members: MembersRepository,
    private readonly bookings: BookingsRepository,
    private readonly audit: AuditLogRepository,
    private readonly sessions: ClientSessionsRepository,
  ) {}

  private scopeBranchId(admin: AdminUser): string | null {
    return admin.role === 'BRANCH_ADMIN' ? (admin.branchId ?? '__no_branch__') : null;
  }

  async list(admin: AdminUser, query: AdminMemberListQuery): Promise<Paginated<MemberAdminView>> {
    const branchId = this.scopeBranchId(admin);
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.members.listAdmin({ q: query.q, branchId, skip, take: query.pageSize }),
      this.members.countAdmin({ q: query.q, branchId }),
    ]);
    const stats = await this.members.bookingStats(rows.map((m) => m.id), branchId);
    return paginated(memberAdminViewSchema).parse({
      items: rows.map((m) => this.toAdminView(m, stats.get(m.id))),
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNextPage: skip + rows.length < total,
    });
  }

  async detail(admin: AdminUser, id: string): Promise<MemberAdminView> {
    const branchId = this.scopeBranchId(admin);
    const member = await this.members.findById(id);
    if (!member) throw ApiError.notFound('Member not found');
    const stats = await this.members.bookingStats([id], branchId);
    const stat = stats.get(id);
    // A Branch Admin may only see a member who has a booking at their branch —
    // no booking there means it does not exist from their vantage (fail closed).
    if (branchId && (!stat || stat.count === 0)) throw ApiError.notFound('Member not found');
    return this.toAdminView(member, stat);
  }

  async bookings_(admin: AdminUser, id: string, query: PaginationQuery): Promise<Paginated<BookingListItem>> {
    const branchId = this.scopeBranchId(admin) ?? undefined;
    const member = await this.members.findById(id);
    if (!member) throw ApiError.notFound('Member not found');
    const skip = (query.page - 1) * query.pageSize;
    const filters = { memberId: id, branchId };
    const [rows, total] = await Promise.all([
      this.bookings.listForAdmin({ ...filters, skip, take: query.pageSize }),
      this.bookings.countForAdmin(filters),
    ]);
    if (branchId && total === 0) throw ApiError.notFound('Member not found');
    return paginated(bookingListItemSchema).parse({
      items: rows.map(mapToBookingListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNextPage: skip + rows.length < total,
    });
  }

  async block(admin: AdminUser, id: string, body: AdminBlockMemberBody): Promise<MemberAdminView> {
    const branchId = this.scopeBranchId(admin);
    const member = await this.members.findById(id);
    if (!member) throw ApiError.notFound('Member not found');
    if (branchId) {
      const stats = await this.members.bookingStats([id], branchId);
      if ((stats.get(id)?.count ?? 0) === 0) throw ApiError.notFound('Member not found');
    }

    const updated = await this.members.setBlocked(id, body.blocked, body.reason);
    if (body.blocked) {
      // Immediate revocation so the block takes effect at once (ADR-0005).
      await this.sessions.revokeAllForMember(id);
    }
    await this.audit.record({
      actorType: 'ADMIN',
      actorId: admin.id,
      action: body.blocked ? 'MEMBER_BLOCKED' : 'MEMBER_UNBLOCKED',
      entityType: 'Member',
      entityId: id,
      metadata: body.reason ? { reason: body.reason } : undefined,
    });

    const stats = await this.members.bookingStats([id], branchId);
    return this.toAdminView(updated, stats.get(id));
  }

  private toAdminView(m: Member, stat?: { count: number; lastBookingAt: Date | null }): MemberAdminView {
    return memberAdminViewSchema.parse({
      id: m.id,
      phone: m.phone,
      phoneVerified: m.phoneVerified,
      name: m.name,
      emergencyContact: m.emergencyContact,
      sex: m.sex,
      lineBound: m.lineBoundAt != null,
      hasLineLogin: m.lineUserId != null,
      isBlocked: m.isBlocked,
      createdAt: m.createdAt.toISOString(),
      bookingCount: stat?.count ?? 0,
      lastBookingAt: stat?.lastBookingAt ? stat.lastBookingAt.toISOString() : null,
    });
  }
}

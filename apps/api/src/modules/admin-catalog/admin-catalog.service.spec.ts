import type { AdminUser } from '../../generated/prisma/client';
import type { BranchesRepository } from '../branches/branches.repository';
import type { SportsRepository } from '../sports/sports.repository';
import type { CourtsRepository } from '../courts/courts.repository';
import type { AuditLogRepository } from '../audit/audit-log.repository';
import { AdminCatalogService } from './admin-catalog.service';

const uid = (n: string) => `00000000-0000-4000-8000-0000000000${n}`;
const BRANCH_A = uid('0a');
const BRANCH_OTHER = uid('0b');
const COURT_1 = uid('c1');
const SPORT_1 = uid('d1');
const OWNER = { id: uid('01'), role: 'OWNER', branchId: null } as AdminUser;
const BRANCH_ADMIN = { id: uid('02'), role: 'BRANCH_ADMIN', branchId: BRANCH_A } as AdminUser;
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const FULL_SCHEDULE = DAYS.map((day) => ({ day, closed: false, openTime: '08:00', closeTime: '22:00' }));

function build() {
  const branches = {
    listAdmin: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    softDelete: jest.fn(),
    hasFutureBookings: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<BranchesRepository>;
  const sports = {} as unknown as jest.Mocked<SportsRepository>;
  const courts = {
    listAdmin: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    softDelete: jest.fn(),
    hasFutureBookings: jest.fn().mockResolvedValue(false),
    deleteBlockScoped: jest.fn().mockResolvedValue(1),
  } as unknown as jest.Mocked<CourtsRepository>;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<AuditLogRepository>;
  return { service: new AdminCatalogService(branches, sports, courts, audit), branches, courts, audit };
}

const branchRow = (over: any = {}) => ({
  id: BRANCH_A,
  name: 'Branch A',
  address: '123 Somewhere Rd',
  paymentMethod: 'PAY_ONSITE',
  promptPayId: null,
  businessHours: FULL_SCHEDULE,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...over,
});

const courtRow = (over: any = {}) => ({
  id: COURT_1,
  branchId: BRANCH_A,
  sportId: SPORT_1,
  name: 'Court 1',
  gridIntervalMinutes: 60,
  maxSlots: 4,
  basePricePerGridUnit: 10000,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  schedule: FULL_SCHEDULE,
  peakTimeRanges: [],
  ...over,
});

describe('AdminCatalogService — branch lifecycle', () => {
  it('blocks soft-delete when future bookings exist (409)', async () => {
    const { service, branches } = build();
    (branches.findById as jest.Mock).mockResolvedValue(branchRow());
    (branches.hasFutureBookings as jest.Mock).mockResolvedValue(true);
    await expect(service.deleteBranch(OWNER, BRANCH_A)).rejects.toMatchObject({
      code: 'SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS',
    });
    expect(branches.softDelete).not.toHaveBeenCalled();
  });

  it('soft-deletes when no future bookings, returning a LifecycleResult', async () => {
    const { service, branches } = build();
    (branches.findById as jest.Mock).mockResolvedValue(branchRow());
    (branches.softDelete as jest.Mock).mockResolvedValue(branchRow({ deletedAt: new Date('2026-02-01T00:00:00.000Z') }));
    const res = await service.deleteBranch(OWNER, BRANCH_A);
    expect(res.deletedAt).not.toBeNull();
  });

  it('deactivate returns isActive=false, deletedAt=null', async () => {
    const { service, branches } = build();
    (branches.findById as jest.Mock).mockResolvedValue(branchRow());
    (branches.setActive as jest.Mock).mockResolvedValue(branchRow({ isActive: false }));
    const res = await service.deactivateBranch(OWNER, BRANCH_A);
    expect(res).toMatchObject({ isActive: false, deletedAt: null });
  });
});

describe('AdminCatalogService — court branch scope', () => {
  it('lets a Branch Admin create a court in their own branch', async () => {
    const { service, courts } = build();
    (courts.create as jest.Mock).mockResolvedValue(courtRow());
    (courts.findById as jest.Mock).mockResolvedValue(courtRow());
    await expect(
      service.createCourt(BRANCH_ADMIN, {
        branchId: BRANCH_A,
        sportId: SPORT_1,
        name: 'Court 1',
        gridIntervalMinutes: 60,
        maxSlots: 4,
        basePricePerGridUnit: 10000,
        peakTimeRanges: [],
        schedule: [],
      } as any),
    ).resolves.toMatchObject({ id: COURT_1 });
  });

  it('denies a Branch Admin creating a court in another branch (403)', async () => {
    const { service, courts } = build();
    await expect(
      service.createCourt(BRANCH_ADMIN, {
        branchId: BRANCH_OTHER,
        sportId: SPORT_1,
        name: 'X',
        gridIntervalMinutes: 60,
        maxSlots: 4,
        basePricePerGridUnit: 10000,
        peakTimeRanges: [],
        schedule: [],
      } as any),
    ).rejects.toMatchObject({ code: 'BRANCH_SCOPE_DENIED' });
    expect(courts.create).not.toHaveBeenCalled();
  });

  it('denies a Branch Admin editing a court in another branch (403)', async () => {
    const { service, courts } = build();
    (courts.findById as jest.Mock).mockResolvedValue(courtRow({ branchId: BRANCH_OTHER }));
    await expect(service.deleteCourt(BRANCH_ADMIN, COURT_1)).rejects.toMatchObject({ code: 'BRANCH_SCOPE_DENIED' });
  });

  it('force-narrows a Branch Admin court list to their own branch', async () => {
    const { service, courts } = build();
    await service.listCourts(BRANCH_ADMIN, undefined);
    expect(courts.listAdmin).toHaveBeenCalledWith({ branchId: BRANCH_A });
  });
});

describe('AdminCatalogService — deleteBlock IDOR guard', () => {
  it('deletes a block that is scoped to the given court', async () => {
    const { service, courts } = build();
    (courts.findById as jest.Mock).mockResolvedValue(courtRow());
    (courts.deleteBlockScoped as jest.Mock).mockResolvedValue(1);
    await service.deleteBlock(OWNER, COURT_1, uid('bb'));
    expect(courts.deleteBlockScoped).toHaveBeenCalledWith(uid('bb'), COURT_1);
  });

  it('rejects (404) deleting a block that does not belong to the given court — cross-court/branch IDOR', async () => {
    const { service, courts } = build();
    // Branch Admin legitimately owns COURT_1 (in their own branch) — scope on
    // courtId passes — but the blockId supplied belongs to some OTHER
    // court/branch. `deleteBlockScoped`'s compound where clause matches zero
    // rows, and the service must fail closed rather than assume success.
    (courts.findById as jest.Mock).mockResolvedValue(courtRow({ branchId: BRANCH_A }));
    (courts.deleteBlockScoped as jest.Mock).mockResolvedValue(0);
    await expect(service.deleteBlock(BRANCH_ADMIN, COURT_1, uid('bb'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(courts.deleteBlockScoped).toHaveBeenCalledWith(uid('bb'), COURT_1);
  });

  it('still 403s before ever reaching the block delete when the courtId itself is out of scope', async () => {
    const { service, courts } = build();
    (courts.findById as jest.Mock).mockResolvedValue(courtRow({ branchId: BRANCH_OTHER }));
    await expect(service.deleteBlock(BRANCH_ADMIN, COURT_1, uid('bb'))).rejects.toMatchObject({
      code: 'BRANCH_SCOPE_DENIED',
    });
    expect(courts.deleteBlockScoped).not.toHaveBeenCalled();
  });
});

describe('AdminCatalogService — branch listing scope (ADR-0005, view_all_branches)', () => {
  it('a Branch Admin only ever sees their own branch in the list (never tenant-wide)', async () => {
    const { service, branches } = build();
    await service.listBranches(BRANCH_ADMIN);
    expect(branches.listAdmin).toHaveBeenCalledWith({ branchId: BRANCH_A });
  });

  it('Owner/Admin see every branch tenant-wide', async () => {
    const { service, branches } = build();
    await service.listBranches(OWNER);
    expect(branches.listAdmin).toHaveBeenCalledWith({ branchId: undefined });
  });

  it('403s a Branch Admin reading another branch by id (full record incl. promptPayId/businessHours)', async () => {
    const { service, branches } = build();
    (branches.findById as jest.Mock).mockResolvedValue(branchRow({ id: BRANCH_OTHER }));
    await expect(service.getBranch(BRANCH_ADMIN, BRANCH_OTHER)).rejects.toMatchObject({ code: 'BRANCH_SCOPE_DENIED' });
  });

  it('lets a Branch Admin read their own branch by id', async () => {
    const { service, branches } = build();
    (branches.findById as jest.Mock).mockResolvedValue(branchRow({ id: BRANCH_A }));
    await expect(service.getBranch(BRANCH_ADMIN, BRANCH_A)).resolves.toMatchObject({ id: BRANCH_A });
  });
});

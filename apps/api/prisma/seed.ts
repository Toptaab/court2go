/**
 * court2go local dev seed — Baseline Club (ARCHITECTURE §8).
 *
 * Seeds exactly one dev Tenant, `slug=baseline-club`, with:
 *  - one Branch on PAY_ONSITE, one Branch on QR_CODE (so both booking-
 *    completion paths are exercisable from day one, per ARCHITECTURE §8).
 *  - one Sport (Padel) with one Court per Branch, day-of-week schedule,
 *    base + one peak price range.
 *  - Tenant Config with the MVP defaults from ARCHITECTURE §9 item 4.
 *  - the Owner AdminUser (PRD A9.1 AC1 — first AdminUser is always Owner).
 *  - a couple of published News posts.
 *
 * Run: `npm run db:seed` (apps/api) — idempotent (upserts on natural keys),
 * safe to re-run against a dev DB.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Role,
  BranchPaymentMethod,
  DayOfWeek,
  NewsStatus,
} from '../src/generated/prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

// v7: driver adapter is mandatory (no Rust engine fallback). The seed script
// runs as the owner/migration role (DATABASE_URL, from prisma.config.ts's
// env loading), never APP_DATABASE_URL — it deliberately bypasses RLS to
// bulk-populate a fresh dev DB, unlike PrismaService at runtime.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
const prisma = new PrismaClient({ adapter });

/** Minimal scrypt password hash — placeholder scheme; apps/api's real
 * AuthAdminService (ADR-0005) owns the actual hashing implementation used
 * at runtime. Format: `scrypt:<saltHex>:<hashHex>` so it's self-describing. */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

const ALL_DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

async function main() {
  console.log('Seeding Baseline Club dev tenant...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'baseline-club' },
    update: {},
    create: {
      slug: 'baseline-club',
      name: 'Baseline Club',
      primaryColor: '#0C8C6A',
      logoUrl: null,
    },
  });

  await prisma.config.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      holdWindowMinutes: 10,
      clientSessionDurationDays: 30,
      otpExpiryMinutes: 5,
      otpMaxAttempts: 5,
      otpResendCooldownSeconds: 60,
      otpMaxSendsPerHour: 5,
      minBookingLeadTimeMinutes: 30,
      maxAdvanceBookingDays: 30,
      cancellationCutoffHours: 2,
      defaultGridIntervalMinutes: 60,
      defaultMaxSlots: 4,
    },
  });

  // Owner AdminUser (PRD A9.1 AC1) — dev-only credentials, never used in prod.
  const ownerEmail = 'court2go@gmail.com';
  const existingOwner = await prisma.adminUser.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: ownerEmail } },
  });
  if (!existingOwner) {
    await prisma.adminUser.create({
      data: {
        tenantId: tenant.id,
        email: ownerEmail,
        passwordHash: hashPassword('admin@123'),
        name: 'Baseline Club Owner',
        role: Role.OWNER,
        branchId: null,
      },
    });
  }

  // Sport has no unique(tenantId, name) constraint (PRD doesn't require
  // name uniqueness), so find-or-create rather than upsert.
  const padel =
    (await prisma.sport.findFirst({ where: { tenantId: tenant.id, name: 'Padel' } })) ??
    (await prisma.sport.create({ data: { tenantId: tenant.id, name: 'Padel' } }));

  const businessHours = ALL_DAYS.map((day) => ({
    day,
    closed: false,
    openTime: '08:00',
    closeTime: '22:00',
  }));

  // --- Branch 1: Pay Onsite ------------------------------------------------
  let branchPayOnsite = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, name: 'Sukhumvit Branch' },
  });
  if (!branchPayOnsite) {
    branchPayOnsite = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Sukhumvit Branch',
        address: '123 Sukhumvit Rd, Bangkok',
        paymentMethod: BranchPaymentMethod.PAY_ONSITE,
        promptPayId: null,
        businessHours,
      },
    });
  }

  // --- Branch 2: QR Code ----------------------------------------------------
  let branchQrCode = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, name: 'Ratchada Branch' },
  });
  if (!branchQrCode) {
    branchQrCode = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Ratchada Branch',
        address: '456 Ratchadaphisek Rd, Bangkok',
        paymentMethod: BranchPaymentMethod.QR_CODE,
        promptPayId: '0891234567',
        businessHours,
      },
    });
  }

  await createCourtWithSchedule({
    tenantId: tenant.id,
    branchId: branchPayOnsite.id,
    sportId: padel.id,
    name: 'Court A',
  });
  await createCourtWithSchedule({
    tenantId: tenant.id,
    branchId: branchQrCode.id,
    sportId: padel.id,
    name: 'Court B',
  });

  // --- News -------------------------------------------------------------
  const newsCount = await prisma.news.count({ where: { tenantId: tenant.id } });
  if (newsCount === 0) {
    await prisma.news.createMany({
      data: [
        {
          tenantId: tenant.id,
          title: 'Welcome to Baseline Club!',
          body: 'Book padel courts online — pay onsite at Sukhumvit, or scan-and-transfer at Ratchada.',
          status: NewsStatus.PUBLISHED,
          publishedAt: new Date(),
        },
        {
          tenantId: tenant.id,
          title: 'Off-peak promo coming soon',
          body: 'Watch this space for weekday morning discounts.',
          status: NewsStatus.DRAFT,
          publishedAt: null,
        },
      ],
    });
  }

  console.log(`Seed complete. Tenant: ${tenant.slug} (${tenant.id})`);
}

async function createCourtWithSchedule(args: {
  tenantId: string;
  branchId: string;
  sportId: string;
  name: string;
}) {
  const existing = await prisma.court.findFirst({
    where: { tenantId: args.tenantId, branchId: args.branchId, name: args.name },
  });
  if (existing) return existing;

  const court = await prisma.court.create({
    data: {
      tenantId: args.tenantId,
      branchId: args.branchId,
      sportId: args.sportId,
      name: args.name,
      gridIntervalMinutes: 60,
      maxSlots: 4,
      basePricePerGridUnit: 40000, // 400.00 THB
      schedule: {
        create: ALL_DAYS.map((day) => ({
          tenantId: args.tenantId,
          day,
          closed: false,
          openTime: '08:00',
          closeTime: '22:00',
        })),
      },
      peakTimeRanges: {
        create: [
          {
            tenantId: args.tenantId,
            label: 'Evening peak',
            days: ['FRI', 'SAT', 'SUN'],
            startTime: '18:00',
            endTime: '22:00',
            pricePerGridUnit: 60000, // 600.00 THB
          },
        ],
      },
    },
  });
  return court;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

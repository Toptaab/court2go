-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('PENDING_VERIFICATION', 'PENDING_PAYMENT', 'PENDING_PAYMENT_CONFIRMATION', 'CONFIRMED', 'CANCELLATION_REQUESTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('AWAITING_SLIP_UPLOAD', 'SLIP_UPLOADED_PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'PAY_ONSITE_NOT_COLLECTED');

-- CreateEnum
CREATE TYPE "branch_payment_method" AS ENUM ('PAY_ONSITE', 'QR_CODE');

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('OWNER', 'ADMIN', 'BRANCH_ADMIN');

-- CreateEnum
CREATE TYPE "sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('LOGIN', 'BIND');

-- CreateEnum
CREATE TYPE "verified_via" AS ENUM ('SELF_OTP', 'ADMIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "news_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "day_of_week" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('MEMBER', 'ADMIN', 'SYSTEM');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "logo_url" TEXT,
    "primary_color" VARCHAR(7),
    "secondary_color" VARCHAR(7),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "hold_window_minutes" INTEGER NOT NULL,
    "client_session_duration_days" INTEGER NOT NULL,
    "otp_expiry_minutes" INTEGER NOT NULL,
    "otp_max_attempts" INTEGER NOT NULL,
    "otp_resend_cooldown_seconds" INTEGER NOT NULL,
    "otp_max_sends_per_hour" INTEGER NOT NULL,
    "min_booking_lead_time_minutes" INTEGER NOT NULL,
    "max_advance_booking_days" INTEGER NOT NULL,
    "cancellation_cutoff_hours" INTEGER NOT NULL DEFAULT 2,
    "default_grid_interval_minutes" INTEGER NOT NULL,
    "default_max_slots" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "payment_method" "branch_payment_method" NOT NULL,
    "prompt_pay_id" VARCHAR(60),
    "business_hours" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "grid_interval_minutes" INTEGER NOT NULL,
    "max_slots" INTEGER NOT NULL,
    "base_price_per_grid_unit" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_schedule_day" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "day" "day_of_week" NOT NULL,
    "closed" BOOLEAN NOT NULL,
    "open_time" VARCHAR(5),
    "close_time" VARCHAR(5),

    CONSTRAINT "court_schedule_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peak_time_range" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "label" VARCHAR(60),
    "days" "day_of_week"[],
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "price_per_grid_unit" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "peak_time_range_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_block" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "reason" VARCHAR(200),
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "court_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "phone" VARCHAR(10),
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "name" VARCHAR(120),
    "emergency_contact" VARCHAR(120),
    "sex" "sex",
    "line_user_id" VARCHAR(64),
    "line_bound_at" TIMESTAMPTZ(6),
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "blocked_reason" VARCHAR(500),
    "blocked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_session" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "client_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenge" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "phone" VARCHAR(10) NOT NULL,
    "purpose" "otp_purpose" NOT NULL,
    "member_id" UUID,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "admin_role" NOT NULL,
    "branch_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_session" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "sport_id" UUID NOT NULL,
    "branch_name" VARCHAR(120) NOT NULL,
    "sport_name" VARCHAR(80) NOT NULL,
    "court_name" VARCHAR(80) NOT NULL,
    "branch_payment_method" "branch_payment_method" NOT NULL,
    "status" "booking_status" NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "grid_interval_minutes" INTEGER NOT NULL,
    "slot_count" INTEGER NOT NULL,
    "verified_via" "verified_via" NOT NULL,
    "is_walk_in" BOOLEAN NOT NULL DEFAULT false,
    "price_breakdown" JSONB NOT NULL,
    "subtotal_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "applied_promotion_id" UUID,
    "promotion_discount_amount" INTEGER,
    "hold_expires_at" TIMESTAMPTZ(6),
    "cancellation_requested_at" TIMESTAMPTZ(6),
    "cancellation_request_reason" VARCHAR(500),
    "cancellation_decision_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_slot" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "slot_start" TIMESTAMPTZ(6) NOT NULL,
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "status" "payment_status" NOT NULL,
    "amount_due" INTEGER NOT NULL,
    "qr_payload" TEXT,
    "slip_object_key" TEXT,
    "slip_uploaded_at" TIMESTAMPTZ(6),
    "reviewed_by_admin_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "description" VARCHAR(200),
    "discount_type" "discount_type" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "branch_id" UUID,
    "sport_id" UUID,
    "court_id" UUID,
    "max_total_uses" INTEGER,
    "max_uses_per_member" INTEGER,
    "total_uses" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_redemption" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "discount_amount" INTEGER NOT NULL,
    "used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "status" "news_status" NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_type" "actor_type" NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "config_tenant_id_key" ON "config"("tenant_id");

-- CreateIndex
CREATE INDEX "branch_tenant_id_is_active_idx" ON "branch"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "sport_tenant_id_is_active_idx" ON "sport"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "court_tenant_id_branch_id_is_active_idx" ON "court"("tenant_id", "branch_id", "is_active");

-- CreateIndex
CREATE INDEX "court_tenant_id_sport_id_is_active_idx" ON "court"("tenant_id", "sport_id", "is_active");

-- CreateIndex
CREATE INDEX "court_schedule_day_tenant_id_court_id_idx" ON "court_schedule_day"("tenant_id", "court_id");

-- CreateIndex
CREATE UNIQUE INDEX "court_schedule_day_court_id_day_key" ON "court_schedule_day"("court_id", "day");

-- CreateIndex
CREATE INDEX "peak_time_range_tenant_id_court_id_idx" ON "peak_time_range"("tenant_id", "court_id");

-- CreateIndex
CREATE INDEX "court_block_tenant_id_court_id_starts_at_ends_at_idx" ON "court_block"("tenant_id", "court_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "member_tenant_id_is_blocked_idx" ON "member"("tenant_id", "is_blocked");

-- CreateIndex
CREATE UNIQUE INDEX "member_tenant_id_phone_key" ON "member"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "member_tenant_id_line_user_id_key" ON "member"("tenant_id", "line_user_id");

-- CreateIndex
CREATE INDEX "client_session_tenant_id_member_id_idx" ON "client_session"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "client_session_tenant_id_expires_at_idx" ON "client_session"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "otp_challenge_tenant_id_phone_created_at_idx" ON "otp_challenge"("tenant_id", "phone", "created_at");

-- CreateIndex
CREATE INDEX "admin_user_tenant_id_branch_id_idx" ON "admin_user"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_tenant_id_email_key" ON "admin_user"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "admin_session_tenant_id_admin_user_id_idx" ON "admin_session"("tenant_id", "admin_user_id");

-- CreateIndex
CREATE INDEX "admin_session_tenant_id_expires_at_idx" ON "admin_session"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "booking_tenant_id_branch_id_starts_at_idx" ON "booking"("tenant_id", "branch_id", "starts_at");

-- CreateIndex
CREATE INDEX "booking_tenant_id_court_id_starts_at_idx" ON "booking"("tenant_id", "court_id", "starts_at");

-- CreateIndex
CREATE INDEX "booking_tenant_id_status_starts_at_idx" ON "booking"("tenant_id", "status", "starts_at");

-- CreateIndex
CREATE INDEX "booking_tenant_id_member_id_starts_at_idx" ON "booking"("tenant_id", "member_id", "starts_at");

-- CreateIndex
CREATE INDEX "booking_tenant_id_status_hold_expires_at_idx" ON "booking"("tenant_id", "status", "hold_expires_at");

-- CreateIndex
CREATE INDEX "booking_slot_tenant_id_court_id_slot_start_released_at_idx" ON "booking_slot"("tenant_id", "court_id", "slot_start", "released_at");

-- CreateIndex
CREATE INDEX "booking_slot_booking_id_idx" ON "booking_slot"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_booking_id_key" ON "payment"("booking_id");

-- CreateIndex
CREATE INDEX "payment_tenant_id_status_idx" ON "payment"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "promotion_tenant_id_is_active_valid_from_valid_until_idx" ON "promotion"("tenant_id", "is_active", "valid_from", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_tenant_id_code_key" ON "promotion"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_redemption_booking_id_key" ON "promotion_redemption"("booking_id");

-- CreateIndex
CREATE INDEX "promotion_redemption_tenant_id_promotion_id_member_id_idx" ON "promotion_redemption"("tenant_id", "promotion_id", "member_id");

-- CreateIndex
CREATE INDEX "news_tenant_id_status_published_at_idx" ON "news"("tenant_id", "status", "published_at");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_entity_type_entity_id_idx" ON "audit_log"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_created_at_idx" ON "audit_log"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "config" ADD CONSTRAINT "config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch" ADD CONSTRAINT "branch_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport" ADD CONSTRAINT "sport_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court" ADD CONSTRAINT "court_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court" ADD CONSTRAINT "court_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court" ADD CONSTRAINT "court_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_schedule_day" ADD CONSTRAINT "court_schedule_day_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_schedule_day" ADD CONSTRAINT "court_schedule_day_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peak_time_range" ADD CONSTRAINT "peak_time_range_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peak_time_range" ADD CONSTRAINT "peak_time_range_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_block" ADD CONSTRAINT "court_block_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_block" ADD CONSTRAINT "court_block_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_session" ADD CONSTRAINT "client_session_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_session" ADD CONSTRAINT "client_session_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenge" ADD CONSTRAINT "otp_challenge_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_applied_promotion_id_fkey" FOREIGN KEY ("applied_promotion_id") REFERENCES "promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slot" ADD CONSTRAINT "booking_slot_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slot" ADD CONSTRAINT "booking_slot_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slot" ADD CONSTRAINT "booking_slot_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- RAW SQL ADDITIONS (owned by prisma-data, hand-written — NOT regenerated by
-- `prisma migrate dev`/`db push` off schema.prisma; see schema.prisma header
-- comment and docs/ERD.md "Raw SQL additions" for the full rationale of why
-- each block below cannot be expressed in schema.prisma's declarative DSL).
-- Do not remove this section on a future `prisma migrate dev` — it will not
-- be regenerated, only replayed from migration history.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. THE double-booking guarantee (ADR-0003, ARCHITECTURE §5.1).
--    One row per booking per fixed 30-minute lock-lattice unit; a PARTIAL
--    unique index means only the ACTIVE (not-yet-released) occupancy of a
--    given court+lattice-instant is constrained — a released row can coexist
--    with rows from an earlier, now-freed booking. A concurrent INSERT that
--    collides raises 23505 unique_violation and rolls back the whole
--    Booking-creation transaction atomically (BookingService catches 23505
--    -> 409 SLOT_UNAVAILABLE).
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX "uniq_active_court_slot"
  ON "booking_slot" ("court_id", "slot_start")
  WHERE "released_at" IS NULL;

-- ----------------------------------------------------------------------------
-- 2. CHECK constraints Prisma's schema DSL cannot express.
-- ----------------------------------------------------------------------------

-- Court: grid interval is one of the fixed MVP set; max slots >= 1; prices
-- are non-negative THB satang.
ALTER TABLE "court"
  ADD CONSTRAINT "court_grid_interval_minutes_check"
    CHECK ("grid_interval_minutes" IN (30, 60, 90, 120)),
  ADD CONSTRAINT "court_max_slots_check"
    CHECK ("max_slots" >= 1),
  ADD CONSTRAINT "court_base_price_non_negative_check"
    CHECK ("base_price_per_grid_unit" >= 0);

-- PeakTimeRange: non-negative price; end strictly after start (HH:MM lexical
-- compare is safe since both are zero-padded 24h "HH:MM"/"24:00" strings).
ALTER TABLE "peak_time_range"
  ADD CONSTRAINT "peak_time_range_price_non_negative_check"
    CHECK ("price_per_grid_unit" >= 0),
  ADD CONSTRAINT "peak_time_range_end_after_start_check"
    CHECK ("end_time" > "start_time");

-- CourtScheduleDay: a non-closed day must carry both open/close times; a
-- closed day carries neither (mirrors packages/types businessHoursDaySchema
-- refine, applied at the Court-schedule granularity).
ALTER TABLE "court_schedule_day"
  ADD CONSTRAINT "court_schedule_day_times_check"
    CHECK (
      ("closed" = TRUE AND "open_time" IS NULL AND "close_time" IS NULL)
      OR ("closed" = FALSE AND "open_time" IS NOT NULL AND "close_time" IS NOT NULL AND "close_time" > "open_time")
    );

-- CourtBlock: a block must span forward in time.
ALTER TABLE "court_block"
  ADD CONSTRAINT "court_block_ends_after_starts_check"
    CHECK ("ends_at" > "starts_at");

-- Branch: promptPayId is required iff paymentMethod = QR_CODE (PRD A4.1 AC6),
-- and must be absent/irrelevant for PAY_ONSITE.
ALTER TABLE "branch"
  ADD CONSTRAINT "branch_prompt_pay_id_required_for_qr_check"
    CHECK (
      ("payment_method" = 'QR_CODE' AND "prompt_pay_id" IS NOT NULL)
      OR ("payment_method" = 'PAY_ONSITE' AND "prompt_pay_id" IS NULL)
    );

-- Member: Thai mobile format when present (PRD NFR9); mirrors
-- packages/types thaiPhoneSchema exactly. NULL is allowed (LINE-only member).
ALTER TABLE "member"
  ADD CONSTRAINT "member_phone_thai_format_check"
    CHECK ("phone" IS NULL OR "phone" ~ '^0\d{9}$');

-- AdminUser: branchId present iff role = BRANCH_ADMIN (PRD A9.1) — Owner/
-- Admin are Tenant-wide and must NOT carry a branch scope.
ALTER TABLE "admin_user"
  ADD CONSTRAINT "admin_user_branch_scope_check"
    CHECK (
      ("role" = 'BRANCH_ADMIN' AND "branch_id" IS NOT NULL)
      OR ("role" <> 'BRANCH_ADMIN' AND "branch_id" IS NULL)
    );

-- Config: hold window is the MVP-fixed {5,10} set (PRD A8.1 AC6); grid
-- default is the fixed {30,60,90,120} set; other numeric rules are positive.
ALTER TABLE "config"
  ADD CONSTRAINT "config_hold_window_minutes_check"
    CHECK ("hold_window_minutes" IN (5, 10)),
  ADD CONSTRAINT "config_default_grid_interval_minutes_check"
    CHECK ("default_grid_interval_minutes" IN (30, 60, 90, 120)),
  ADD CONSTRAINT "config_default_max_slots_check"
    CHECK ("default_max_slots" >= 1),
  ADD CONSTRAINT "config_otp_rules_check"
    CHECK ("otp_expiry_minutes" > 0 AND "otp_max_attempts" > 0
      AND "otp_resend_cooldown_seconds" >= 0 AND "otp_max_sends_per_hour" > 0),
  ADD CONSTRAINT "config_lead_time_rules_check"
    CHECK ("min_booking_lead_time_minutes" >= 0 AND "max_advance_booking_days" >= 1
      AND "cancellation_cutoff_hours" >= 0),
  ADD CONSTRAINT "config_client_session_duration_check"
    CHECK ("client_session_duration_days" >= 1);

-- Booking: span integrity + non-negative money; slotCount/gridInterval
-- against the specific Court's maxSlots is a cross-table rule enforced in
-- BookingService (packages/domain validators), not here.
ALTER TABLE "booking"
  ADD CONSTRAINT "booking_ends_after_starts_check"
    CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "booking_slot_count_check"
    CHECK ("slot_count" >= 1),
  ADD CONSTRAINT "booking_grid_interval_minutes_check"
    CHECK ("grid_interval_minutes" IN (30, 60, 90, 120)),
  ADD CONSTRAINT "booking_amounts_non_negative_check"
    CHECK ("subtotal_amount" >= 0 AND "total_amount" >= 0);

-- Payment: non-negative amount.
ALTER TABLE "payment"
  ADD CONSTRAINT "payment_amount_due_non_negative_check"
    CHECK ("amount_due" >= 0);

-- Promotion: discount value positive; percentage capped at 100; validity
-- window forward; usage caps positive when present.
ALTER TABLE "promotion"
  ADD CONSTRAINT "promotion_discount_value_positive_check"
    CHECK ("discount_value" > 0),
  ADD CONSTRAINT "promotion_percentage_cap_check"
    CHECK ("discount_type" <> 'PERCENTAGE' OR "discount_value" <= 100),
  ADD CONSTRAINT "promotion_validity_window_check"
    CHECK ("valid_until" > "valid_from"),
  ADD CONSTRAINT "promotion_usage_caps_positive_check"
    CHECK (("max_total_uses" IS NULL OR "max_total_uses" > 0)
      AND ("max_uses_per_member" IS NULL OR "max_uses_per_member" > 0)
      AND "total_uses" >= 0);

-- PromotionRedemption: non-negative discount amount.
ALTER TABLE "promotion_redemption"
  ADD CONSTRAINT "promotion_redemption_discount_amount_non_negative_check"
    CHECK ("discount_amount" >= 0);

-- News: a PUBLISHED post must carry a publish timestamp.
ALTER TABLE "news"
  ADD CONSTRAINT "news_published_at_required_check"
    CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 3. Least-privilege runtime role (ARCHITECTURE §2.1) — `apps/api`'s
--    PrismaService connects as THIS role at request time (APP_DATABASE_URL),
--    never as the migration/table-owner role (DATABASE_URL). Postgres table
--    owners bypass Row-Level Security by default, so RLS is only a real
--    guarantee if the runtime connection is a non-owner, non-superuser role.
--
--    Local-dev convenience password below; production provisioning MUST
--    rotate this via infra/secrets management, not by editing this migration
--    (migrations are forward-only/immutable once applied to a shared branch
--    — see docs/HANDOFF.md "Migrations forward-only").
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE "app_user" LOGIN PASSWORD 'app_user' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO "app_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "app_user";

-- ----------------------------------------------------------------------------
-- 4. Row-Level Security (ARCHITECTURE §2.1) — the HARD tenant-isolation
--    guarantee (PRD NFR4, "critical-severity defect" if ever violated).
--    Every tenant-owned table gets RLS enabled + one FOR ALL policy keyed off
--    `current_setting('app.tenant_id', true)`, which `apps/api`'s Prisma
--    Client Extension sets via `SET LOCAL app.tenant_id = '<uuid>'` as the
--    first statement of every request's transaction (ARCHITECTURE §2.1).
--    If unset (e.g. a stray unscoped query), `current_setting(..., true)`
--    returns NULL, the `= NULL` comparison is never true, and the policy
--    fails closed — zero rows, not an information leak. `Tenant` itself is
--    intentionally excluded (it IS the scoping root, not tenant-owned).
--
--    ENABLE (not FORCE) ROW LEVEL SECURITY: the migration/owner role
--    (DATABASE_URL) legitimately needs unrestricted access to run migrations
--    and seed data; Postgres table owners already bypass RLS by default
--    without FORCE, so FORCE is neither required nor desired here — the
--    actual isolation guarantee comes from `app_user` never being the owner.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'config', 'branch', 'sport', 'court', 'court_schedule_day',
    'peak_time_range', 'court_block', 'member', 'client_session',
    'otp_challenge', 'admin_user', 'admin_session', 'booking',
    'booking_slot', 'payment', 'promotion', 'promotion_redemption',
    'news', 'audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid)
         WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
      t
    );
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 5. Defense-in-depth: DB-level mirror of the "Booking reaches CONFIRMED only
--    if Payment ∈ {CONFIRMED, PAY_ONSITE_NOT_COLLECTED}" convergence rule
--    (ARCHITECTURE §6.2/§7, §9 item 5). The APPLICATION-level guarantee is
--    `BookingService.transitionToConfirmed()` as the sole writer of
--    status=CONFIRMED; this trigger is cheap insurance against a future bug
--    or an out-of-band write bypassing that service method.
--
--    DEFERRABLE INITIALLY DEFERRED: Booking.status and Payment.status are
--    updated as two separate statements inside the SAME transaction (whole
--    -transaction atomicity per ADR-0003's pattern), in either order — the
--    check must run at COMMIT time against the final state of both rows, not
--    mid-transaction.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_booking_confirmed_requires_valid_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_status_val payment_status;
BEGIN
  IF NEW.status IS DISTINCT FROM 'CONFIRMED' THEN
    RETURN NEW;
  END IF;

  SELECT status INTO payment_status_val FROM payment WHERE booking_id = NEW.id;

  IF payment_status_val IS NULL THEN
    RAISE EXCEPTION 'booking % cannot be CONFIRMED without an associated payment row', NEW.id
      USING ERRCODE = '23514';
  END IF;

  IF payment_status_val NOT IN ('CONFIRMED', 'PAY_ONSITE_NOT_COLLECTED') THEN
    RAISE EXCEPTION 'booking % cannot be CONFIRMED while payment status is %', NEW.id, payment_status_val
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_booking_confirmed_requires_valid_payment
  AFTER INSERT OR UPDATE OF status ON "booking"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_confirmed_requires_valid_payment();

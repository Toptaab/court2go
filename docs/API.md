# court2go — API Contract Overview

**Version:** 1.0.0 · **Base path:** `/v1` · **Spec:** [`docs/openapi.yaml`](./openapi.yaml) (OpenAPI 3.1)
**Source of truth:** zod schemas in [`packages/types`](../packages/types). This doc + the
OpenAPI file are aligned to those schemas (ARCHITECTURE §3.1/§7). If they ever disagree,
`packages/types` wins.

This is the human-readable index. Every request/response shape named below is a zod schema
exported from `@repo/types`.

---

## Conventions

### Tenant scoping (ARCHITECTURE §2.2)
Every endpoint is tenant-scoped. Tenant context is carried differently per surface:

| Surface | How tenant is resolved | Trust |
|---|---|---|
| Public/anonymous (`/tenants/by-slug`, availability, news, branches…) | `X-Tenant-Id` header (web middleware resolves it from the URL slug) | validated against the slug |
| Member (session) | `ClientSession.tenantId` from cookie `c2g_member_session` | **session wins** over any header |
| Admin (session) | `AdminSession.tenantId` from cookie `c2g_admin_session` | **session wins**; URL slug is cosmetic |

A session minted on Tenant A is inert on Tenant B. Postgres RLS is the hard backstop.

### Auth
- **Member**: opaque DB-backed session, cookie `c2g_member_session` (httpOnly, Secure, SameSite=Lax). Established by phone+OTP verify or LINE callback. **Booking eligibility depends on `Member.phoneVerified`, a field separate from having a session.**
- **Admin**: opaque DB-backed session, cookie `c2g_admin_session`, email+password login (ADR-0005). Role + branch scope read server-side from `AdminUser` every request. Both sessions are revocable instantly (block member / remove admin).

### Error envelope (ARCHITECTURE §3.4)
Every non-2xx: `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
Switch on `code` (`API_ERROR_CODES`), never message text. Key codes:

`VALIDATION_ERROR` (400) · `UNAUTHENTICATED` (401) · `OTP_INVALID`/`OTP_EXPIRED`/`OTP_MAX_ATTEMPTS`/`OTP_RATE_LIMITED` (401/429) · `FORBIDDEN`/`BRANCH_SCOPE_DENIED`/`MEMBER_BLOCKED`/`PHONE_NOT_VERIFIED`/`OWNER_IMMUTABLE` (403) · `NOT_FOUND`/`TENANT_NOT_FOUND` (404) · **`SLOT_UNAVAILABLE` (409)** · `HOLD_EXPIRED`/`INVALID_STATE_TRANSITION`/`DUPLICATE_MEMBER`/`SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS`/`PROMO_NOT_APPLICABLE`/`CANCELLATION_CUTOFF_PASSED` (409) · `RATE_LIMITED` (429).

### Pagination
Page-based: `?page=1&pageSize=20` → `{ items, page, pageSize, total, hasNextPage }`.

### Money, time, IDs
- Money: integer **THB satang** (300.00 THB = `30000`). Never floats.
- Instants: ISO-8601 UTC. Wall-clock hours: `HH:MM`. Dates: `YYYY-MM-DD`.
- IDs: UUID. Phones: Thai national `0XXXXXXXXX`.

### Versioning
`X-Contract-Version: 1.0.0` on every response. Breaking change ⇒ MAJOR bump ⇒ both apps fail to compile until they react.

---

## Endpoint index

### Public / tenant bootstrap
| Method | Path | Auth | Req → Res |
|---|---|---|---|
| GET | `/tenants/by-slug/{slug}` | none | → `PublicTenant` (identity + branding + public config) |
| GET | `/news` | none (tenant hdr) | `PaginationQuery` → `Paginated<PublicNews>` |
| GET | `/news/{newsId}` | none | → `PublicNews` |

### Client booking flow (public read, session to finalize)
| Method | Path | Auth | Req → Res |
|---|---|---|---|
| GET | `/branches` | none | → `PublicBranch[]` (active only) |
| GET | `/branches/{branchId}/sports` | none | → `PublicSport[]` (sports w/ ≥1 active court) |
| GET | `/branches/{branchId}/sports/{sportId}/courts` | none | → `PublicCourt[]` |
| GET | `/courts/{courtId}` | none | → `PublicCourt` |
| GET | `/courts/{courtId}/availability?date=` | none | `AvailabilityQuery` → `AvailabilityResponse` |
| POST | `/courts/{courtId}/holds` | member session¹ | `CreateHoldBody {start, slotCount, promoCode?}` → `CreateHoldResponse` · **409 SLOT_UNAVAILABLE** |
| GET | `/bookings/{bookingId}` | member (owner) | → `BookingDetail` |
| POST | `/bookings/{bookingId}/promotion` | member | `ApplyPromoBody` → `BookingDetail` |
| DELETE | `/bookings/{bookingId}/promotion` | member | → `BookingDetail` |
| GET | `/bookings/{bookingId}/payment` | member | → `Payment` (QR branch: includes dynamic PromptPay QR) |
| POST | `/bookings/{bookingId}/payment/slip-upload-url` | member | `SlipUploadUrlBody` → `SlipUploadUrlResponse` (presigned PUT) |
| POST | `/bookings/{bookingId}/payment/slip` | member | `ConfirmSlipBody {objectKey}` → `BookingDetail` |
| POST | `/bookings/{bookingId}/cancellation-request` | member | `CancellationRequestBody` → `BookingDetail` |
| GET | `/me/bookings` | member | `MyBookingsQuery` → `Paginated<BookingListItem>` |

¹ A hold can also be created *before* verification; the response's `nextStep` (`VERIFY_PHONE` \| `UPLOAD_SLIP` \| `CONFIRMED`) drives the flow. If unauthenticated, the client verifies via OTP first (that call establishes the session).

### Member auth & profile
| Method | Path | Auth | Req → Res |
|---|---|---|---|
| POST | `/auth/otp/request` | none / member² | `OtpRequestBody {phone, purpose}` → `OtpRequestResponse` |
| POST | `/auth/otp/verify` | none / member | `OtpVerifyBody` → `MemberSessionResponse` (Set-Cookie) |
| POST | `/auth/line/login-url` | none | → `LineLoginUrlResponse` |
| POST | `/auth/line/callback` | none | `LineCallbackBody` → `MemberSessionResponse` (Set-Cookie) |
| POST | `/auth/logout` | member | → 204 |
| GET | `/me` | member | → `Me` |
| PATCH | `/me` | member | `UpdateProfileBody` → `Me` |
| POST | `/integrations/line/link-url` | member | → `LineOaLinkUrlResponse` (OA notification binding) |
| POST | `/webhooks/line` | LINE sig³ | LINE event → 200 |

² `purpose=BIND` (attach phone to a LINE member, or change phone from profile) requires an active member session; `purpose=LOGIN` does not.
³ Deliberately public; verifies `x-line-signature` HMAC (ARCHITECTURE §4.2).

### Admin — auth
| Method | Path | Auth | Req → Res |
|---|---|---|---|
| POST | `/admin/auth/login` | none | `AdminLoginBody` → `AdminSessionResponse` (Set-Cookie) |
| POST | `/admin/auth/logout` | admin | → 204 |
| GET | `/admin/me` | admin | → `AdminMe` |

### Admin — bookings, calendar, queues
| Method | Path | Auth | Req → Res |
|---|---|---|---|
| GET | `/admin/bookings` | admin (branch-scoped) | `AdminBookingListQuery` → `Paginated<BookingListItem>` |
| GET | `/admin/bookings/calendar` | admin | `AdminCalendarQuery {branchId, date}` → `BookingListItem[]` |
| POST | `/admin/bookings` | admin | `AdminCreateBookingBody` (walk-in, no OTP) → `BookingDetail` · **409 SLOT_UNAVAILABLE** |
| GET | `/admin/bookings/{id}` | admin | → `BookingDetail` |
| PATCH | `/admin/bookings/{id}` | admin | `AdminModifyBookingBody` (time/court/slotCount) → `BookingDetail` · **409 SLOT_UNAVAILABLE** |
| POST | `/admin/bookings/{id}/cancel` | admin | `AdminCancelBookingBody` → `BookingDetail` |
| POST | `/admin/bookings/{id}/outcome` | admin | `AdminSetBookingOutcomeBody` (COMPLETED/NO_SHOW) → `BookingDetail` |
| POST | `/admin/bookings/{id}/payment/confirm` | admin | `AdminConfirmPaymentBody` → `BookingDetail` |
| POST | `/admin/bookings/{id}/payment/reject` | admin | `AdminRejectPaymentBody` → `BookingDetail` |
| GET | `/admin/bookings/{id}/payment/slip-url` | admin | → `SlipViewUrlResponse` (signed GET) |
| POST | `/admin/bookings/{id}/cancellation-decision` | admin | `AdminCancellationDecisionBody` (APPROVE/DECLINE) → `BookingDetail` |

The **slip-review queue** = `GET /admin/bookings?paymentStatus=SLIP_UPLOADED_PENDING_REVIEW`.
The **cancellation queue** = `GET /admin/bookings?status=CANCELLATION_REQUESTED`.
Pay-Onsite bookings never appear in the slip queue (PRD A2.3 AC5).

### Admin — catalog (Branch / Sport / Court)
Each of Branch/Sport/Court follows the same lifecycle: `GET` list, `POST` create, `GET`/`PATCH` by id,
`POST …/deactivate` (allowed anytime), `DELETE …` (soft-delete; **409 SOFT_DELETE_BLOCKED_FUTURE_BOOKINGS**).

| Method | Path | Req → Res |
|---|---|---|
| GET/POST | `/admin/branches`, `/admin/branches/{id}` (GET/PATCH) | `UpsertBranchBody` ↔ `Branch` |
| POST | `/admin/branches/{id}/deactivate` · DELETE `/admin/branches/{id}` | → `LifecycleResult` |
| GET/POST | `/admin/sports`, `/admin/sports/{id}` | `UpsertSportBody` ↔ `Sport` |
| POST/DELETE | `/admin/sports/{id}/deactivate`, `/admin/sports/{id}` | → `LifecycleResult` |
| GET/POST | `/admin/courts`, `/admin/courts/{id}` | `UpsertCourtBody` ↔ `Court` (branch-scoped for Branch Admin) |
| POST/DELETE | `/admin/courts/{id}/deactivate`, `/admin/courts/{id}` | → `LifecycleResult` |
| GET/POST | `/admin/courts/{id}/blocks` | `CreateCourtBlockBody` → `CourtBlock` |
| DELETE | `/admin/courts/{id}/blocks/{blockId}` | → 204 |

### Admin — promotions, news, members, config, branding, roles
| Method | Path | Req → Res |
|---|---|---|
| GET/POST | `/admin/promotions`, `/admin/promotions/{id}` (GET/PATCH) | `UpsertPromotionBody` ↔ `Promotion` |
| POST/DELETE | `/admin/promotions/{id}/deactivate`, `/admin/promotions/{id}` | → `LifecycleResult` |
| GET | `/admin/promotions/{id}/usage` | → `Paginated<PromotionUsageItem>` |
| GET/POST | `/admin/news`, `/admin/news/{id}` (GET/PATCH) | `UpsertNewsBody` ↔ `News` |
| DELETE | `/admin/news/{id}` | → 204 |
| GET | `/admin/members` | `AdminMemberListQuery` → `Paginated<MemberAdminView>` |
| GET | `/admin/members/{id}` | → `MemberAdminView` |
| GET | `/admin/members/{id}/bookings` | → `Paginated<BookingListItem>` (branch-scoped) |
| POST | `/admin/members/{id}/block` | `AdminBlockMemberBody` → `MemberAdminView` |
| GET/PUT | `/admin/config` | `UpdateConfigBody` ↔ `Config` |
| GET/PUT | `/admin/branding` | `UpdateBrandingBody` ↔ `Branding` |
| POST | `/admin/uploads/image-url` | `ImageUploadUrlBody` → `ImageUploadUrlResponse` (logo/news) |
| GET/POST | `/admin/admin-users`, `/admin/admin-users/{id}` (GET/PATCH) | `CreateAdminUserBody`/`UpdateAdminUserBody` ↔ `AdminUser` (OWNER/ADMIN only) |
| DELETE | `/admin/admin-users/{id}` | → 204 · **403 OWNER_IMMUTABLE** / `FORBIDDEN` per ADR-0005 rules |
| GET | `/admin/roles-matrix` | → `RolesMatrix` |

---

## Lifecycle notes the contract encodes

- **Hold → verify → pay/confirm** (ARCHITECTURE §6). `CreateHoldResponse.nextStep` forks on `Branch.paymentMethod` + `Member.phoneVerified`:
  - Pay-Onsite + verified → `CONFIRMED` immediately (`Payment=PAY_ONSITE_NOT_COLLECTED`).
  - QR + verified → `UPLOAD_SLIP` (`Booking=PENDING_PAYMENT`, `Payment=AWAITING_SLIP_UPLOAD`).
  - not verified → `VERIFY_PHONE` (OTP LOGIN or BIND) then re-evaluate.
- **Concurrency**: hold/modify/walk-in all can return **409 SLOT_UNAVAILABLE** (Postgres partial unique index, ARCHITECTURE §5). `EXPIRED` is reachable from `PENDING_VERIFICATION` for *both* branch types (ADR-0006).
- **Pricing** is the sum of per-grid-unit prices (`PriceBreakdown.units`), server-authoritative and snapshotted. Client previews via `packages/domain` only.
- **Branch Admin** scope is enforced server-side on every `/admin/*` resource by branch, even against a crafted id (PRD A9.1 AC4).

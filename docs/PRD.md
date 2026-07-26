# PRD: Court/Venue Booking SaaS Platform

**Author:** Product Analyst (AI-assisted draft)
**Date:** 2026-07-22, last revised 2026-07-24 (revision 6. Revision 4 resolved nearly all remaining Open Questions, incl. a correction that OTP verifies a phone number **once per Member**, not on every booking, and that OTP is delivered via SMS, never LINE OA. Revision 5 added a new MVP feature: **per-Branch payment method** — each Branch is configured as either "No Payment / Pay Onsite" (booking auto-confirms after phone verification, no payment collected online) or "QR Code" (the manual bank-transfer-slip + Admin-confirmation flow). Revision 6 is a correction to the QR Code option: it is **not** a static uploaded QR image — the Branch configures its **PromptPay ID** only, and the system **dynamically generates a fresh, amount-embedded PromptPay QR code at the payment step of each booking**. This is still not a payment gateway and does not auto-verify payment — the client still uploads a slip and an Admin still manually confirms/rejects it; the dynamic QR is purely a convenience so the correct amount pre-fills for the client.)
**Status:** Draft. Confirmed hard MVP requirements as of this revision (in addition to all prior revisions): dual login methods (phone+OTP or LINE login) with a long-lived session used for browsing/history/profile; a Member's phone is verified via SMS OTP exactly once (at phone+OTP login, or as a one-time capture step for LINE-login accounts with no phone) — once verified, no further OTP is required for that Member's future bookings while logged in; OTP delivered via SMS only (LINE OA is never used for OTP); LINE OA notifications delivered only to clients who have bound/linked their LINE OA; self-service cancellation requests (up to 2 hours before start) subject to admin approval; three admin roles (Owner, Admin, Branch Admin) with defined scoping; Court deactivate-then-soft-delete lifecycle (soft-delete blocked while future bookings exist); mixed peak/base pricing charged as the sum of per-range portions; optional Member profile fields (name, emergency contact, sex); and a **per-Branch payment method setting** (Pay Onsite vs. QR Code) that determines whether a booking auto-confirms after phone verification or goes through the manual slip-upload-and-Admin-confirm flow. Remaining Open Questions (now very few) are in Section 9.

---

## 1. Problem Statement & Product Vision

### Problem statement

Sports venue operators (padel, tennis, badminton, futsal, basketball courts, etc.) that run multiple branches and courts today manage bookings through phone calls, LINE chats, spreadsheets, or generic scheduling tools not built for courts. This causes double-bookings, no-shows with no accountability, wasted staff time on manual confirmation, and no visibility into utilization across branches. Players, meanwhile, want a fast, no-login-hassle way to check court availability and reserve a slot without downloading a new app or creating a password-based account, and to pay the way they already do locally (bank transfer, confirmed by the venue). Existing global platforms (Playtomic, Matchi, CourtReserve) are strong but are built around a marketplace/network model, deep club-management feature sets, and card-based accounts — more than many independent, regional Thai operators need, and a poor fit for a market where phone-number identity, OTP-as-login, LINE messaging, and manual bank-transfer confirmation are the natural trust and payment mechanisms.

**Who has the pain:**

- **Venue owners/operators** running one or more branches (a single operator/Tenant may run many branches), each with multiple courts across one or more sports, who need a simple back-office to control availability, stop double-bookings, set day-specific hours and base/peak pricing per court, and review/confirm incoming payments.
- **Admin/front-desk staff** who need a fast way to see "what's booked, right now, across all courts," to create/modify/cancel bookings on behalf of walk-in or phone-in customers without friction, and to review uploaded payment slips and confirm or reject them.
- **End clients (players)** who want to see venue news/promotions, then book a court in under a minute on their phone, log in just once via OTP (no password), pay by uploading a transfer slip, and see their own booking history.

**Why now:** Court sports (padel especially) are seeing rapid growth in venue counts in Thailand, and independent/regional operators are digitizing from manual processes for the first time. A multi-tenant, mobile-first, phone-first booking SaaS — with LINE OA as the communication channel Thai consumers already use daily, and a lightweight manual bank-transfer-slip payment model that doesn't require integrating a payment gateway — lowers the barrier for these operators to go digital quickly.

### Product vision

A multi-tenant, mobile-first SaaS booking platform where each venue operator (Tenant) — which may run many branches — configures their own branches, sports, courts (each with its own day-of-week schedule and base/peak pricing), and a light-branded (logo + CI color) public presence, in strict data isolation from every other tenant. Clients land on a Tenant's public News Feed first, can browse and book a court (Branch → Sport → Court → start time → duration), log in painlessly via phone + OTP or via LINE (their phone is verified by SMS OTP just once, after which repeat bookings need no further verification), and pay by uploading a bank-transfer slip that an Admin manually reviews and confirms — with OTP delivered via SMS and all other client notifications (confirmations, rejections, cancellation updates) delivered via LINE Official Account to clients who've linked it. Operators get a single admin console to manage bookings, courts, pricing, promotions, members, news content, and payment confirmations in one place. v1 is scoped to the Thai market (Thai phone numbers, THB currency, LINE OA); tenants themselves are provisioned by the platform's internal operations team rather than through self-service signup.

---

## 2. Goals & Success Metrics

### Goals (what "done and working" means for v1)

1. A venue operator (Tenant) — who may operate many branches — can independently configure branches, sports, courts (including day-of-week schedules and base/peak pricing), durations, promotions, news content, and branding, and start accepting public bookings without engineering help, with data fully isolated from every other tenant.
2. A client can go from "landing on the news feed" to "booking submitted and awaiting/confirmed" in a fast, mobile-first flow: log in once via phone + OTP (skipped entirely on return visits thanks to session/login), select a slot, and upload a payment slip.
3. Two clients can never successfully reserve the same court for the same overlapping time in the same duration/court, including while a booking is on Hold, awaiting slip upload, or awaiting admin payment review.
4. Admin staff can see, on one screen, all bookings for a given day/branch across courts (calendar view), including both booking status and payment status, and can search/find/modify/cancel any booking, and review/confirm/reject uploaded payment slips.
5. Every Confirmed booking in the system is tied to (a) a phone-verified/logged-in Member (or an explicit, auditable staff-created override) and (b) a Payment that an Admin has explicitly confirmed (via slip review, or direct confirmation for walk-ins); no booking reaches Confirmed status without both.
6. Bookable start times align to each Court's configured **grid interval** (chosen from the fixed set {30, 60, 90, 120 minutes}); a booking spans 1..`maxSlots` contiguous grid units (max slots is per-Court config), so its total duration = slot count × grid interval; and pricing correctly reflects each Court's base/peak schedule summed across the occupied grid units.

### Success metrics (v1 targets — to be confirmed with business stakeholder)

| Metric | Target |
| --- | --- |
| Booking completion rate (started booking → Confirmed, including admin payment confirmation) | ≥ 60% |
| OTP delivery success rate (via SMS, for Members whose phone isn't yet verified) | ≥ 95% |
| OTP verification success rate (of OTPs delivered) | ≥ 90% |
| Double-booking incidents (same court/grid-units double-confirmed, or double-reserved during Hold/pending-review) | 0 |
| Unpaid/expired holds not released automatically (should always be 0) | 0 |
| Payment slip review turnaround (slip upload → admin confirm/reject decision), during business hours | < 30 minutes |
| Share of uploaded slips ultimately Confirmed (vs. Rejected) | ≥ 90% |
| Median time from slot selection to slip upload (client-controlled portion of the flow) | < 3 minutes |
| Admin task: time to locate a specific booking (list/search) | < 15 seconds |
| Admin-reported scheduling conflicts per month (post-launch) | Trending to 0 within 60 days of onboarding |
| Client repeat-booking rate within 30 days | Baseline to be established at launch, then tracked for growth |

*(Numeric targets are placeholders pending stakeholder sign-off — flagged again in Open Questions.)*

---

## 3. Personas

### 3.1 Venue Owner / Operator ("Aida, Branch-Chain Owner")

- Owns/operates one Tenant account that may run many branches (confirmed: one Tenant → many Branches, no fixed limit in MVP), each with several courts across 1-3 sports (e.g., padel + tennis).
- Goals: reduce no-shows and manual coordination, set day-specific hours and peak-hour pricing per court, run promotions to fill off-peak slots, post news/announcements to clients, apply her venue's own logo/colors to the public pages, and review incoming payment slips quickly.
- Frustrations: today juggles LINE chats and a shared spreadsheet; double-bookings cause customer complaints; no visibility into which branch/court is under-utilized; chasing clients for proof of payment is manual and error-prone.
- Technical comfort: moderate; wants a control panel, not code.

### 3.2 Admin / Front-Desk Staff ("Youssef, Branch Admin")

- Works at a single branch, handles walk-ins and phone calls, needs to create bookings on behalf of customers who don't want to self-serve (skipping OTP for these), and needs to review uploaded payment slips and confirm/reject them.
- Goals: quickly check "is this court free at 6pm today," book a walk-in in under 30 seconds without requiring the customer to verify by OTP, confirm a client's payment slip in seconds, resolve a customer dispute by finding their booking (and payment status) fast.
- Frustrations: currently switches between a paper calendar and a phone; no single source of truth; wants a simple queue of "payments awaiting review."
- Technical comfort: basic; needs a fast, low-friction interface (interface design is out of scope for this PRD, but the *requirement* of speed/simplicity is in scope).

### 3.3 End Client / Player ("Sara, Weekend Player")

- Books courts for herself and her friend group, usually within a few days of playing, sometimes same-day; uses her phone almost exclusively (mobile-first).
- Goals: see venue news/promos, check what's available quickly, book without creating a password-based account, log in once via OTP and stay logged in afterward, pay by transferring money and uploading a screenshot/photo of the slip, get a clear confirmation once the venue reviews it, see her upcoming/past bookings later.
- Frustrations: doesn't want to download an app or remember another password; doesn't want to enter card details; wants to know her booking is genuinely held while she's transferring money and waiting for the venue to confirm.
- Technical comfort: casual smartphone user; already uses LINE daily and is comfortable receiving OTPs and notifications there; comfortable uploading a bank-app screenshot as proof of payment.

### 3.4 (Secondary) Platform/SaaS Internal Operations ("Internal Ops")

- Not a venue's own staff — this is the SaaS vendor's own internal team responsible for provisioning new Tenants onto the platform, since **multi-tenancy is a confirmed MVP requirement but self-service tenant sign-up is not**. In MVP, this persona manually sets up a new Tenant (its branches, its first AdminUser, and its initial branding — logo/CI colors) when a new venue operator is onboarded commercially.
- Goals: provision a new Tenant quickly and correctly, with confidence that its data (including Members, bookings, and payment slip images) is fully isolated from all other tenants; monitor platform health across tenants.
- Out of scope for MVP: this persona does not need a public self-service signup/billing flow — that is deferred (see Section 7).

---

## 4. Domain Glossary / Core Entities (Conceptual)

These are conceptual entities to align product, design, and engineering — not a database schema.

- **Tenant** — A single venue-operator business/account on the SaaS platform. **Multi-tenancy is a confirmed, hard MVP requirement.** Every Branch, Sport, Court, Slot, Booking, Member, Client Session, Promotion, Payment, News/Announcement, Config, and AdminUser belongs to exactly one Tenant. **Confirmed: a single Tenant may operate many Branches** (one-to-many, no fixed limit assumed for MVP). Tenants are provisioned manually by the platform's internal operations team in MVP — there is no self-service tenant sign-up/onboarding flow in v1. Strict data isolation between Tenants is a hard requirement (see Non-Functional Requirements), and includes a Tenant's own Branding (logo, CI color(s)) applied to its public News Feed and booking pages.
- **Branch** — A physical location/site belonging to exactly one Tenant (e.g., "Downtown Branch," "Marina Branch"). Has its own address and set of Courts; a Tenant may have any number of Branches. Each Branch has a configurable **payment method** setting (admin/owner-controlled), one of: **"No Payment / Pay Onsite"** (bookings skip the payment/slip flow entirely and auto-confirm after phone verification, to be paid at the venue counter) or **"QR Code"** (the manual bank-transfer-slip flow, but with a **dynamically generated PromptPay QR** shown to the client — see Payment, below). For the QR Code option, the Branch stores its **PromptPay ID** (the Branch's PromptPay-registered phone number, national ID, or e-wallet ID) — **not** a static QR image — from which the system generates a fresh, amount-embedded PromptPay QR code at the payment step of each booking. There is still **no payment gateway** in MVP under either option — the dynamic QR only pre-fills the correct amount for the client's convenience; the client still transfers manually, uploads a slip, and an Admin still manually confirms/rejects it — there is no automatic payment verification.
- **Sport** — A type of activity offered (e.g., Padel, Tennis, Futsal, Badminton). Defined at the Tenant level and assigned to Courts; not shared across Tenants.
- **Court** — A single bookable physical unit. Belongs to exactly one Branch (and therefore exactly one Tenant) and is associated with exactly one Sport. Each Court has its own: (a) **day-of-week schedule** — which days it is open, and open/close times per day (a day can be marked fully closed); (b) a **grid interval** — the court's atomic slot size, chosen by the admin from the fixed set **{30, 60, 90, 120} minutes** (this sets the start-time grid spacing for that court: a 30-min grid gives start points 08:00, 08:30, 09:00…; a 60-min grid gives 08:00, 09:00, 10:00…); (c) a **max slots** setting — the maximum number of contiguous grid units a single booking may span (minimum is always 1 grid unit); (d) a **base (normal) price** (per grid unit); and (e) one or more **Peak Time Ranges**, each with its own start/end time (and applicable day(s) of week) and its own override price. The price for a given booking is derived from which time range — a configured Peak range, or the base/default range otherwise — each occupied grid unit falls into.
- **Slot** — Availability is expressed on a **per-Court start-time grid** whose interval is the Court's configured **grid interval** ({30, 60, 90, or 120} minutes), anchored to the Court's open time for the day (e.g., a 60-min grid on a court opening 08:00 gives grid points 08:00, 09:00, 10:00, …). A booking selects a start time from this grid plus a **slot count** — a number of contiguous grid units from **1 up to the Court's `maxSlots`** — occupying that many contiguous grid units. A booking's total duration = slot count × grid interval. Each grid unit's state is Available, Held (mid-checkout), Booked/Pending Payment Confirmation (slip uploaded, awaiting admin review), or Booked (Confirmed).
- **Booking** — A reservation of one Court, for one contiguous span of grid units (a start time + a slot count of 1..`maxSlots`, at the Court's grid interval), by one Member, within one Tenant. **Booking status is tracked separately from Payment status** (see Payment, below). Booking status values: Pending Verification, Pending Payment (verified/logged-in, awaiting slip upload — **QR Code Branches only**), Pending Payment Confirmation (slip uploaded, awaiting admin review — **QR Code Branches only**), Confirmed (either an Admin confirmed the payment slip on a QR Code Branch, or — on a **Pay Onsite** Branch — auto-confirmed immediately after phone verification, with no payment step at all), **Cancellation Requested** (client requested cancellation, awaiting admin approval), Rejected (admin rejected the payment; QR Code Branches only), Expired (Hold expired with no slip uploaded; QR Code Branches only), Cancelled, Completed, No-Show.
- **Member** — A client identified uniquely by phone number **within a given Tenant** (phone number is the one mandatory field, though it may be captured slightly after account creation for LINE-login Members — see Client Session, below). A Member record carries a **phone-verified flag**: once a phone number has been verified via SMS OTP (whether at initial phone+OTP login, or via a one-time capture-and-bind step for a LINE-login Member with no phone), it stays verified permanently — no re-verification is required for that Member's future bookings while logged in. Optional fields — **name, emergency contact, and sex** — may be added or edited later via a profile screen; none are required to complete a booking. The same phone number may correspond to separate, independent Member records in different Tenants (preserving tenant data isolation). Holds booking history scoped to that Tenant.
- **Client Session / Login** — Represents a logged-in state for a Member on the client's device, established via either **(a) phone number + OTP verification** (this OTP both logs the client in and verifies their phone, in one step), **or (b) LINE login** (LINE account authentication, which does not by itself require or verify a phone number). A Client Session is **long-lived** (configurable duration, e.g., weeks/months) and, while active, lets the client browse the News Feed, view booking history, and edit their profile without re-verifying. **Booking behavior depends on the Member's phone-verified state, not on session state alone:** a logged-in client whose Member record already has a verified phone books with **no further OTP**; a client logged in via LINE with **no phone verified yet** is prompted for phone + OTP the first time they book (or whenever they choose to add a phone) — a **one-time** step that binds (sets + verifies) the phone to their account, after which no further OTP is needed for that Member's bookings.
- **OTP Verification** — A short-lived, single-use one-time code delivered via **SMS to the client's phone number** (SMS is the sole OTP channel in MVP — **LINE OA is never used to deliver OTPs**). Used to (a) authenticate a phone+OTP login, or (b) capture and bind a phone number to a Member's account **once**, for a LINE-login Member who does not yet have a verified phone. Once a Member's phone is verified, subsequent bookings by that (logged-in) Member do not require additional OTP. LINE OA is used only for LINE login and for non-OTP notifications (see Config/NFR).
- **Payment** — A record tracking how a specific Booking's cost was settled. **In MVP there is no payment gateway and no automatic payment verification**, under either Branch payment-method option. For a **QR Code** Branch, payment is: the system **dynamically generates a PromptPay QR code** for that specific booking (a standard Thai PromptPay/EMVCo QR payload built from the Branch's configured PromptPay ID, with the booking's amount due embedded so it pre-fills in the client's banking app); the client scans it, transfers, and uploads an image of the bank-transfer slip as proof of payment; an Admin then reviews the slip and manually confirms or rejects it (for staff-created walk-in bookings, an Admin may instead mark payment Confirmed directly, without a slip — e.g., cash collected in person). Generating the QR does not itself confirm anything — it is purely a convenience so the correct amount is pre-filled; confirmation is always a manual Admin action. A Payment holds: the amount due (derived from the Court's base/peak price summed across each occupied grid unit — base and Peak portions where a booking spans both, minus any applied Promotion, in **THB** — this is the amount embedded in the generated QR), a status, an uploaded slip image reference (if applicable), the identity of the Admin who confirmed/rejected it (if applicable), and a confirmation/rejection timestamp. Payment status values: **Awaiting Slip Upload, Slip Uploaded – Pending Review, Confirmed, Rejected** (all QR Code-Branch-only), plus **Pay Onsite / Not Collected Online** — a distinct, immediately-terminal status used only for bookings at a **Pay Onsite** Branch, meaning no money was collected through the platform and the client pays at the venue counter. A Booking only reaches Confirmed status once its associated Payment reaches either Payment-Confirmed (QR Code path) or Pay Onsite / Not Collected Online (Pay Onsite path).
- **Promotion** — A discount or promo code (percentage or fixed amount off, with validity window, usage limits, and optional scoping to Branch/Sport/Court) that a Member can apply during booking; the discount is reflected in the amount due before the client is asked to transfer money/upload a slip.
- **News/Announcement** — A Tenant-scoped content post (title, body text, optional image, publish status, publish date) shown in that Tenant's public **News Feed**, which is the default landing screen for that Tenant's public site (reachable before the booking flow).
- **AdminUser** — A staff account with one of **three confirmed MVP roles**: **Owner** (the account that registered the Tenant; full access to everything Tenant-wide; cannot be removed/revoked by any other AdminUser), **Admin** (full access identical to Owner, Tenant-wide, EXCEPT that the Owner can remove/revoke this account at any time), or **Branch Admin** (scoped to exactly one Branch; can only access that Branch's bookings, members, and courts — no visibility or action outside their assigned Branch). Every AdminUser is scoped to exactly one Tenant.
- **Config** — Tenant/Branch/Court-level settings, including: business-hours defaults; per-Court **grid interval** (the atomic slot size, from the fixed 30/60/90/120-minute set) which sets that court's start-time grid spacing; per-Court **max slots** (max contiguous grid units per booking); per-Court day-of-week open/closed schedule and hours; per-Court base and Peak-range pricing; booking lead-time/cutoff rules; cancellation policy (including the 2-hour self-service cancellation-request cutoff); OTP retry/expiry rules; the Tenant's **Hold window** (a Tenant-level choice of **5 or 10 minutes**); the **Client Session default duration** (long-lived, configurable per Tenant); and **Tenant Branding** (logo image, CI color(s)).

---

## 5. User Stories & Acceptance Criteria

Stories are grouped into two sides — **Client Booking Side** and **Admin Console Side** — each broken into epics. Every story includes Given/When/Then acceptance criteria intended to be directly testable. Unless otherwise noted, every acceptance criterion below is implicitly scoped to a single Tenant (see NFR on data isolation).

### 5.A Client Booking Side

#### Epic C0 — Public News Feed (Landing Page)

**C0.1** — As an end client, I want to land on a Tenant's news/announcements feed when I first visit its public site, so that I can see updates and promotions before booking.

- **AC1:** Given I navigate to a Tenant's public URL, when the page loads, then I see that Tenant's News Feed (published Announcements, newest first) as the **default landing screen** — not the booking flow.
- **AC2:** Given I want to book a court, when I choose a clear "Book Now" entry point from the News Feed, then I am taken into the Branch → Sport → Court → Slot booking flow (Epic C1).
- **AC3:** Given a Tenant has no published Announcements, when the feed loads, then I see a clear empty/default state, with the "Book Now" entry point still available.
- **AC4:** Given the News Feed is displayed, when shown, then it reflects the Tenant's Branding (logo, CI color(s)) — exact visual treatment is a UI/UX decision, but the underlying requirement that Tenant Branding is applied is in scope.

#### Epic C1 — Browse & Select Availability

**C1.1** — As an end client, I want to select a Branch, then a Sport, then a Court, then a start time, so that I can find the exact court and time I want.

- **AC1:** Given I am on a Tenant's booking flow, when it loads, then I see a list/selector of active Branches for that Tenant only (inactive/disabled branches, and any other Tenant's branches, are never shown).
- **AC2:** Given I have selected a Branch, when I proceed, then I see only the Sports that have at least one active Court in that Branch.
- **AC3:** Given I have selected a Branch and Sport, when I proceed, then I see only the Courts in that Branch matching that Sport.
- **AC4:** Given I have selected a Court, when I view availability for a selectable date, then I see a grid of possible start times **at that Court's configured grid interval** ({30, 60, 90, or 120} minutes), each marked Available or Unavailable based on real-time data and that Court's day-of-week schedule (a day the Court is configured as closed shows no available start times).
- **AC5:** Given a grid unit is already Booked, Held, or Pending Payment Confirmation, when I view it, then it is shown as unavailable and cannot be the basis of a new selection.

**C1.2** — As an end client, I want to select the grid slots I want directly on the availability grid — tapping to extend a contiguous run — so that I can book exactly as much time as I need without a separate duration/count control.

- **AC1:** Given a Court's availability grid (slots sized at the Court's **grid interval**), when I tap an available slot, then it becomes my selection. There is **no separate duration or slot-count picker** — the grid itself is the selector, and each slot's length is the venue-configured grid interval (the client never chooses a slot length).
- **AC2 (extend):** Given I already have a selected slot (or contiguous run), when I tap an available slot **immediately adjacent** to my current selection (the next slot forward or the previous slot backward), then my selection **extends** to include it as one contiguous run — up to the Court's **`maxSlots`** cap. Tapping a slot at the far end of the run (or de-selecting the last-added slot) shrinks it.
- **AC3 (reset on non-adjacent):** Given I have a current selection, when I tap an available slot that is **not adjacent** to it (a different, disconnected time), then my previous selection is **cleared** and a fresh selection starts at the tapped slot.
- **AC4 (contiguity + limits):** Given a slot is already Booked, Held, or Pending Payment Confirmation (or past/closed/beyond lead-time), when I try to include it or extend across it, then it is not selectable and the run cannot cross it — a selection is always one contiguous unbroken run of available slots, never exceeding `maxSlots` or the Court's closing time for that day.
- **AC5 (hold):** Given I have a valid contiguous selection (1..`maxSlots` slots) and proceed, when I finalize, then all selected grid units are placed on Hold together as a single booking attempt (start time = first selected slot; slot count = length of the run) for the duration of my checkout.
- **AC6 (pricing):** Given my selected run covers grid units falling in both the base schedule and a configured Peak Time Range, when the price is calculated, then it is the **sum of the per-grid-unit prices** — each unit charged at the base or peak rate for the time range its start falls into (see A5.1 AC9) — e.g., on a 30-min-grid court a 3-slot (90-minute) run with the first unit in the base range and the next two in a Peak range is charged (1 × base) + (2 × peak).

**C1.3** — As an end client, I want unavailable/past slots to be clearly non-selectable, so that I don't attempt to book something impossible.

- **AC1:** Given the current date/time, when I view today's grid, then any grid unit whose start time has already passed is shown as unavailable/disabled.
- **AC2:** Given a grid unit is within the tenant's configured minimum booking lead time, when I view it, then it is shown as unavailable.

#### Epic C2 — Login (Phone+OTP or LINE) and One-Time Phone Verification

**C2.1** — As an end client, I want to log in via phone + OTP or via LINE, so that I have a persistent account that remembers me for browsing news, viewing booking history, and editing my profile.

- **AC1:** Given I log in via phone number + OTP (first-time or returning), when OTP verification succeeds, then a **long-lived Client Session** is established for that Member (session duration is configurable per Tenant, e.g., weeks/months), **and** my phone number is marked verified on my Member record (this same OTP both logs me in and verifies my phone, in one step).
- **AC2:** Given I log in via **LINE login** (LINE account authentication), when LINE authentication succeeds, then a long-lived Client Session is established for that Member, **even if no phone number is yet associated with the account** — LINE login by itself does not require or verify a phone number.
- **AC3:** Given I have an active Client Session (via either login method), when I browse the News Feed, view my booking history, or edit my profile, then I am **not** required to verify via OTP for these actions.
- **AC4:** Given I choose to log out (e.g., on a shared device), when I log out, then my session ends and I must log in again (via phone+OTP or LINE) for session-gated actions.
- **AC5:** Given my Client Session is long-lived, when I return to the site after time has passed, then I remain logged in unless I have explicitly logged out or the Tenant-configured session duration has elapsed.

**C2.2** — As a logged-in end client whose Member record already has a verified phone number, I want to book without any additional OTP step, so that repeat bookings are fast and frictionless.

- **AC1:** Given I have an active Client Session **and** my Member record's phone-verified flag is already set (from a prior phone+OTP login, or from a prior one-time phone-binding per C2.3), when I select a Branch/Sport/Court/start time/duration and proceed to finalize the booking, then I am **not** prompted for OTP — the booking proceeds directly to payment (slip upload) using my verified phone/Member identity.
- **AC2:** Given I am **not** logged in, **or** my Member record's phone-verified flag is not yet set, when I proceed to book, then I must complete the phone-capture-and-OTP step (C2.3/C2.4/C2.5) before the booking can proceed to payment.

**C2.3** — As an end client who is logged in via LINE and has no phone number on file, I want to be prompted once for my phone number and an OTP, so that my phone gets captured, verified, and remembered for all future bookings.

- **AC1:** Given I am logged in via LINE and my Member record has no verified phone number, when I attempt to book (my first booking, or any booking before I've added a phone), then I am prompted to enter a phone number and complete SMS OTP verification (per C2.4/C2.5).
- **AC2:** Given that OTP verification succeeds, when it completes, then the phone number is captured, marked verified, and permanently bound to my existing Member record (no new/duplicate Member is created) — my Booking then proceeds to payment.
- **AC3:** Given my phone is now verified and bound, when I make any subsequent booking (with an active session), then no further OTP is required (per C2.2 AC1) — this was a **one-time** step for this Member, not a per-booking requirement.
- **AC4:** Given I am not logged in at all (no session via phone+OTP or LINE), when I proceed to book, then I must enter a phone number and complete OTP verification (C2.4/C2.5), which both verifies my phone and establishes a login session (per C2.1 AC1) — after which future bookings need no further OTP (per C2.2).

**C2.4** — As an end client, I want to enter my phone number and receive an OTP via SMS, so that I can verify it's really me, whenever verification is actually required (per C2.2/C2.3).

- **AC1:** Given phone verification is required for me right now (per C2.2 AC2 or C2.3), when I reach this step, then I am prompted to enter/confirm a phone number.
- **AC2:** Given I submit a valid Thai phone number, when I request a code, then an OTP is sent via **SMS** — the sole OTP channel in MVP; **LINE OA is never used to deliver OTPs** — and the system records the request timestamp.
- **AC3:** Given I submit an invalid/malformed (non-Thai) phone number, when I request a code, then I receive a clear validation error and no OTP is sent.
- **AC4:** Given a phone number has never been seen before **for this Tenant**, when OTP verification succeeds, then a new Member record is created for that Tenant using that phone number as the Tenant-scoped unique identifying key — **unless** I am already logged in via LINE with no phone set, in which case the number is bound to my existing Member record instead of creating a new one (per C2.3 AC2).
- **AC5:** Given a phone number already exists as a Member **for this Tenant**, when OTP verification succeeds, then I am associated with (and, if applicable, logged into) that existing Member record for that Tenant (no duplicate Member is created within the Tenant, and no data is shared with any other Tenant's Member record for the same number).

**C2.5** — As an end client, I want to enter the OTP code I received, so that I can complete verification.

- **AC1:** Given I received an OTP, when I enter the correct code within the validity window, then verification succeeds, my Member record's phone-verified flag is set (if not already), a Client Session is established/renewed (per C2.1 AC1), and I am allowed to proceed to the payment (slip upload) step for the booking in progress, if any.
- **AC2:** Given I enter an incorrect code, when I submit it, then I see an error message and remain able to retry, up to a configured maximum number of attempts.
- **AC3:** Given I exceed the maximum number of incorrect attempts (configurable — exact value an Open Question), when I try again, then further attempts for that OTP are blocked and I must request a new code.
- **AC4:** Given an OTP has passed its expiry window (configurable — exact value an Open Question), when I attempt to verify it, then verification fails with a clear "code expired" message and I must request a new code.
- **AC5:** Given I need a new code, when I request a resend, then a rate limit applies (exact values an Open Question) to prevent abuse.

**C2.6** — As the product/business owner, I want it to be impossible for a Booking to reach Confirmed status unless the booking Member has a verified phone number — verified either previously or via a fresh OTP in this flow — so that every booking is trustworthy and traceable to a real phone number.

- **AC1:** Given a client has selected Branch/Sport/Court/start time/duration and their Member record has **no** verified phone (and no successful OTP has been completed in this flow), when any attempt is made to proceed to payment or finalize the booking, then the system rejects it and the held grid units are not marked Booked.
- **AC2:** Given the client's Member record already has a verified phone and an active session (per C2.2), when they proceed, then the Booking record stores a reference to the Member's verified-phone status, and the Booking moves to "Pending Payment" status (not yet Confirmed) — no fresh OTP event is required or expected for this booking.
- **AC3:** Given a slot was placed on Hold while a client was completing phone capture + OTP verification (per C2.3/C2.4/C2.5), when the Hold expires before verification completes, then the held grid units are released back to Available for other clients.
- **AC4:** Given two different clients attempt to hold the same grid units concurrently, when only one completes verification/proceeds first, then the other is informed the slot is no longer available.

#### Epic C6 — Client Profile

**C6.1** — As a logged-in end client, I want to view and edit my profile (name, emergency contact, sex — all optional), so that I can add these details whenever I like without them ever blocking a booking.

- **AC1:** Given I am logged in (active Client Session, via either login method), when I open my profile, then I can view and edit the optional fields: name, emergency contact, and sex.
- **AC2:** Given I leave any or all optional fields blank, when I save, then this is allowed — no field beyond phone number is mandatory for any Member.
- **AC3:** Given I update a profile field, when I save, then the change is reflected in my Member record immediately and is visible to Admins in Member Management (A7).
- **AC4:** Given I want to change or add my phone number from my profile, when I initiate that change, then it must go through the same SMS OTP verification as C2.4/C2.5 before the new number is bound to my account (preserving phone-verification integrity).

#### Epic C3 — Payment (Branch-Configured: Pay Onsite or QR Code Slip Upload)

**C3.0** — As an end client, I want the payment step to automatically match however the Branch I'm booking at has been configured, so that I follow the right flow for that specific venue.

- **AC1:** Given the Branch I'm booking at is configured with payment method **"No Payment / Pay Onsite,"** when I complete phone verification (per Epic C2), then the payment/slip-upload step is **skipped entirely**, and my booking proceeds straight to Confirmed (see C3.3) — no QR is shown and no slip is required.
- **AC2:** Given the Branch I'm booking at is configured with payment method **"QR Code,"** when I complete phone verification, then I proceed into the slip-upload flow below (C3.1/C3.2), and the system **dynamically generates a PromptPay QR code for this specific booking**, using that Branch's configured PromptPay ID, with my booking's exact amount due embedded in the QR.

**C3.1** — As an end client booking at a **QR Code** Branch, I want to scan a dynamically generated PromptPay QR with the correct amount already embedded, then upload a photo/image of my bank-transfer slip after logging in/verifying, so that my payment can be reviewed and my booking confirmed.

- **AC1:** Given I have an active Client Session or have just completed OTP verification, my Branch is configured for **QR Code** payment, and my grid-unit Hold is still active, when I proceed to payment, then the system generates a **fresh PromptPay QR code for this specific booking attempt** (built from the Branch's configured PromptPay ID, with the exact amount due — the Court's base or peak price for my selected time range and duration, minus any applied Promotion, in THB — embedded in the QR payload so it pre-fills in my banking app), and I am prompted to scan it, transfer that amount, and upload an image of my bank-transfer slip as proof.
- **AC2:** Given I upload a slip image within the Tenant's configured Hold window (5 or 10 minutes), when the upload completes, then: the Booking status changes to **"Pending Payment Confirmation,"** the Payment record is created/updated with status **"Slip Uploaded – Pending Review"** and a reference to the uploaded image, and the corresponding grid units **remain reserved** (not released to Available) pending Admin review.
- **AC3:** Given I do not upload a slip within the configured Hold window, when the window expires, then the Hold is released, the grid units return to Available, and the Booking is marked **Expired** (not Confirmed).
- **AC4:** Given I have uploaded a slip and am awaiting Admin review, when I check my booking, then I see a "Pending Payment Confirmation" status and understand my booking is reserved but not yet final.
- **AC5:** Given an Admin confirms my uploaded payment, when confirmation happens, then my Booking status changes to **Confirmed**, the grid units remain Booked, and I am notified (via LINE OA).
- **AC6:** Given an Admin rejects my uploaded payment (e.g., unclear or incorrect slip), when rejection happens, then my Booking status changes to **Rejected**, the grid units are released back to Available, and I am notified (via LINE OA) with the ability to attempt a new booking.
- **AC7:** Given there is no additional automatic timeout once a slip has been uploaded (the reservation holds indefinitely pending Admin action in MVP — there is no gateway to auto-verify), when I am waiting, then my grid units remain mine (not double-bookable) unless and until an Admin explicitly rejects the payment.

**C3.2** — As an end client, I want to see the live status of my booking/payment (awaiting slip / pending review / confirmed / rejected / expired), so that I know exactly where things stand.

- **AC1:** Given I am on the payment step before uploading, when a Hold is active, then I see a countdown/remaining-time indicator before the Hold expires.
- **AC2:** Given I have uploaded a slip, when status is "Pending Payment Confirmation," then I see a clear "awaiting venue confirmation" state (no specific ETA is guaranteed in MVP).
- **AC3:** Given payment is Confirmed or Rejected, or the Hold/expiry occurs, when status updates, then I am clearly informed of the outcome and, where relevant (Hold expiry, Rejected), told that the previously held grid units have been released.

**C3.3** — As an end client booking at a **Pay Onsite** Branch, I want my booking to be automatically confirmed as soon as my phone is verified, so that I don't have to submit any payment proof online.

- **AC1:** Given the Branch is configured for **"No Payment / Pay Onsite"** and phone verification succeeds (per Epic C2 — either already verified, or freshly verified in this flow), when verification completes, then the Booking status changes directly to **Confirmed** — with no slip upload and no Admin payment review — and the Payment status is set to **"Pay Onsite / Not Collected Online."**
- **AC2:** Given my booking is Confirmed via Pay Onsite, when confirmation completes, then I see a confirmation summary that clearly states the amount due is to be paid **at the venue counter**, and I receive a confirmation notification (via LINE OA, if linked).
- **AC3:** Given a Pay Onsite booking is Confirmed, when I (or an Admin) view it later, then its Payment status reads **"Pay Onsite / Not Collected Online"** — clearly distinct from the QR-Code path's Awaiting Slip Upload / Slip Uploaded – Pending Review / Confirmed / Rejected statuses.
- **AC4:** Given the Branch is Pay Onsite, when the Hold logic runs, then the Hold only needs to cover slot selection through phone verification — there is no payment/slip-upload window to wait for (per NFR2).

#### Epic C4 — Booking Confirmation, Promotions & Cancellation

**C4.1** — As an end client, I want to see a confirmation once my booking reaches Confirmed status — whether via Admin payment confirmation at a QR Code Branch, or automatically at a Pay Onsite Branch — so that I have proof of a guaranteed reservation.

- **AC1:** Given my Booking becomes Confirmed (by either path), when confirmation completes, then I see a confirmation summary (branch, sport, court, date/time, duration, amount due/paid, any promo applied, and — for Pay Onsite bookings — a clear note that payment is collected at the venue) and receive a confirmation notification via LINE OA (if linked).

**C4.2** — As an end client, I want to optionally apply a promo code before uploading my payment slip, so that I can benefit from an active discount.

- **AC1:** Given I enter a valid, active promo code applicable to my selected Branch/Sport/Court, when I apply it, then the discount is reflected in the amount due shown before I am asked to transfer money/upload a slip.
- **AC2:** Given I enter an invalid, expired, or inapplicable promo code, when I apply it, then I see a clear rejection reason and no discount is applied.
- **AC3:** Given a promo code has a usage limit (total or per-Member), when that limit is reached, then further attempts to apply it are rejected with a clear message.

**C4.3** — As an end client, I want to request cancellation of a booking, so that I can free up the slot if my plans change, with the venue confirming the cancellation.

- **AC1:** Given I have a Confirmed, future, paid booking, when I request cancellation **more than 2 hours before the booking's start time**, then a cancellation request is created (Booking status changes to **Cancellation Requested**) and routed to the venue's Admin for approval; the booking is not yet Cancelled at this point, and its grid units remain reserved until an Admin decides.
- **AC2:** Given I attempt to request cancellation **within 2 hours of the booking's start time, or after it has started**, when I try, then I am blocked from self-requesting cancellation and shown the 2-hour cutoff policy message (an Admin may still cancel it directly, per A2.1).
- **AC3:** Given an Admin approves my cancellation request, when approved, then the Booking status changes to **Cancelled**, its grid units return to Available (if still in the future), and I am notified.
- **AC4:** Given an Admin declines my cancellation request, when declined, then the Booking remains **Confirmed** (unchanged), and I am notified, optionally with a reason.
- **AC5:** Given a Confirmed booking made at a **QR Code** Branch (i.e., money was collected via bank transfer) is ultimately Cancelled (whether via this request flow or directly by an Admin), when cancellation completes, then — **since there is no payment gateway in MVP** — any refund is handled **manually by the Admin, off-platform** (e.g., a manual bank transfer back to the client); the system records that the booking was cancelled and does not automate any refund transaction. Given instead a Confirmed booking made at a **Pay Onsite** Branch is Cancelled, then no refund logic applies at all, since no money was ever collected through the platform.

#### Epic C5 — Booking History

**C5.1** — As an end client, I want to view my booking history using my logged-in session (via phone+OTP or LINE login), so that I can see my upcoming and past bookings without a password account.

- **AC1:** Given I have an active Client Session (established via either phone+OTP or LINE login), when I access "my bookings," then I immediately see a list of all bookings tied to my Member record **for that Tenant** (upcoming and past), across all branches of that tenant — no OTP required (viewing history never requires OTP; a fresh booking only requires OTP if my Member record's phone is not yet verified, per C2.2/C2.3).
- **AC2:** Given I do not have an active session, when I access "my bookings," then I am first required to log in (via phone+OTP per C2.3/C2.4, or via LINE), after which a session is established and my history is shown.
- **AC3:** Given I have no bookings yet, when I view my history, then I see a clear empty state rather than an error.
- **AC4:** Given I view a booking, when I open it, then I can see its full detail (branch, sport, court, date/time, duration, booking status, payment status, promo applied if any, amount) and any allowed actions (e.g., cancel, per policy).

---

### 5.B Admin Console Side

All Admin Console modules below operate within a single Tenant's scope; an AdminUser only ever sees and manages the data of the Tenant (and, if further scoped, the Branch(es)) they are assigned to. The Admin Console is primarily desktop-oriented (see NFRs).

#### Epic A1 — Calendar View

**A1.1** — As an Admin/Branch staff member, I want a calendar view of all bookings across courts and time, so that I can see at a glance what's booked and what's free.

- **AC1:** Given I open the calendar view, when it loads, then I see bookings plotted against courts on the 30-minute start-time grid for a selected date, scoped to my Tenant and permitted Branch(es) only.
- **AC2:** Given I change the selected date or Branch filter, when I apply the filter, then the calendar updates to reflect only that date/branch's bookings and availability.
- **AC3:** Given a booking exists in any status (Pending Verification, Pending Payment, Pending Payment Confirmation, Confirmed, Rejected, Expired, Cancelled, Completed, No-Show), when shown on the calendar, then its booking status **and** payment status (including, for Pay Onsite Branches, the distinct **"Pay Onsite / Not Collected Online"** payment status) are both visually distinguishable (exact visual treatment is a UI/UX decision; the underlying data distinction is the requirement here).
- **AC4:** Given I click/select a booking on the calendar, when I do so, then I can view its full details, including Payment status/amount and (if applicable) the uploaded slip.

#### Epic A2 — Booking List, Manual Creation & Payment Confirmation

**A2.1** — As an Admin, I want a searchable/filterable list of bookings, so that I can find and manage a specific booking quickly.

- **AC1:** Given I open the booking list, when it loads, then I can filter by Branch, Sport, Court, date range, booking status (including "Cancellation Requested"), and payment status — including a dedicated "awaiting my review" filter for **Pending Payment Confirmation** (QR Code Branches only) and a distinct **"Pay Onsite / Not Collected Online"** payment-status value for bookings at Pay Onsite Branches. **If I am a Branch Admin, the list is restricted to bookings at my assigned Branch only; Owner and Admin see all Branches within the Tenant.**
- **AC2:** Given I search by a client's phone number, when I submit the search, then I see all bookings for that Member within my Tenant (within my assigned Branch only, if I am a Branch Admin).
- **AC3:** Given I select a booking, when I choose to modify it (e.g., change time/court/duration, subject to availability and the fixed-duration-set rules) or cancel it directly, then the change is applied and the underlying grid-unit availability is updated accordingly, and (if configured) the client is notified via LINE OA. Refunds for a cancelled paid booking are handled manually/off-platform (per C4.3 AC5).
- **AC4:** Given I select a booking to mark as a No-Show or Completed, when I update its status, then the status change is recorded and reflected in reporting/history.

**A2.2** — As an Admin, I want to manually create a booking on behalf of a walk-in/phone-in client without requiring OTP, so that I can serve customers who don't self-serve online.

- **AC1:** Given I create a booking manually, when I search by phone number, then I either select an existing Member (matched within my Tenant) or quick-create a new Member by entering a phone number, with the system validating that the number is not already a duplicate Member within my Tenant.
- **AC2:** Given I am creating a booking as an Admin, when I finalize it, then **no OTP verification is required** — this is an explicit, auditable staff override (the system records that this booking was staff-created rather than client self-verified).
- **AC3:** Given I have collected payment in person (e.g., cash) or otherwise wish to confirm payment immediately for a walk-in, when I mark the Payment as Confirmed directly (without requiring a slip upload), then the Booking becomes Confirmed immediately, and this direct confirmation is recorded (auditable) as an admin action, distinct from the client slip-upload flow.
- **AC4:** Given I select grid units that are already Booked, Held, or Pending Payment Confirmation, when I attempt to confirm, then the system prevents the double-booking and shows a clear conflict message.

**A2.3** — As an Admin, I want to review uploaded payment slips and confirm or reject them, so that bookings become fully Confirmed only after I've verified payment — **for QR Code Branches only**.

- **AC1:** Given a booking has status "Pending Payment Confirmation" with an uploaded slip (only possible at a **QR Code** Branch), when I open it, then I see the slip image, the amount due, and Confirm/Reject actions.
- **AC2:** Given I confirm the payment, when I do so, then the Payment status changes to Confirmed, the Booking status changes to Confirmed, and this action is recorded with my identity and a timestamp (for audit).
- **AC3:** Given I reject the payment, when I do so, then the Payment status changes to Rejected, the Booking status changes to Rejected, the grid units release back to Available, and the client is notified via LINE OA.
- **AC4:** Given multiple bookings are awaiting payment confirmation, when I filter the booking list by "Pending Payment Confirmation," then I can work through them as a review queue.
- **AC5:** Given a Branch is configured for **Pay Onsite**, when bookings are made there, then they **never** appear in this slip-review queue — they auto-confirm (per C3.3) and require no Admin payment action at all.

**A2.4** — As an Admin, I want to review client-submitted cancellation requests and approve or decline them, so that self-service cancellations are controlled by the venue.

- **AC1:** Given a booking has status "Cancellation Requested" (client-submitted, more than 2 hours before start, per C4.3 AC1), when I open it, then I can **Approve** (Booking status → Cancelled, grid units released, client notified) or **Decline** (Booking status → Confirmed again, client notified, optionally with a reason).
- **AC2:** Given I approve or decline a cancellation request, when I do so, then this action is recorded (auditable) with my identity and a timestamp; any refund on approval is handled manually/off-platform per C4.3 AC5.
- **AC3:** Given multiple cancellation requests are pending, when I filter the booking list by "Cancellation Requested," then I can work through them as a queue.

#### Epic A3 — Sport Management

**A3.1** — As an Admin/Owner, I want to create, edit, deactivate, and soft-delete Sports (scoped to my Tenant), so that I can control which activities are offered. *(Sport and Branch, below, are assumed to follow the same deactivate-then-soft-delete pattern confirmed for Courts in A5.1 — deactivation is allowed anytime, soft-deletion is blocked while future bookings exist.)*

- **AC1:** Given I create a new Sport with a name, when I save it, then it becomes available for assignment to Courts within my Tenant only.
- **AC2:** Given I edit an existing Sport's details, when I save changes, then all Courts within my Tenant referencing that Sport reflect the updated details.
- **AC3:** Given I deactivate a Sport, when I confirm, then it can be deactivated **at any time** — it immediately stops being offered on any of its Courts for new bookings, and no longer appears in the client-facing selector for my Tenant; existing future Confirmed bookings are unaffected by deactivation alone.
- **AC4:** Given I attempt to soft-delete a Sport, when I confirm, then the system allows it only if **no future bookings** exist against any Court using that Sport; if future bookings exist, soft-deletion is blocked with a clear message until those bookings have passed or been cancelled.
- **AC5:** Given a Sport has any booking history (past or present), when I attempt hard/permanent deletion, then the system prevents it, to preserve historical booking integrity (soft-delete, not hard delete, is the supported removal path).

#### Epic A4 — Branch Management

**A4.1** — As an Admin/Owner, I want to create, edit, deactivate, and soft-delete Branches (scoped to my Tenant — and I may create as many Branches as my venue operates), so that I can manage the venue's physical locations. *(Branch is assumed to follow the same deactivate-then-soft-delete pattern confirmed for Courts in A5.1.)*

- **AC1:** Given I create a new Branch with required details (name, address, business hours), when I save it, then it becomes available for Court assignment within my Tenant and appears in my Tenant's client-facing selector once it has at least one active Court. There is no fixed limit on the number of Branches a Tenant can create.
- **AC2:** Given I edit a Branch's business hours, when I save changes, then future availability generation for that Branch's Courts reflects the new hours (existing Confirmed bookings outside new hours are not silently deleted).
- **AC3:** Given I deactivate a Branch, when I confirm, then it can be done **at any time** — it immediately stops accepting new bookings across all its Courts and no longer appears in my Tenant's client-facing selector; existing future Confirmed bookings are unaffected by deactivation alone.
- **AC4:** Given I attempt to soft-delete a Branch, when I confirm, then the system allows it only if **no future bookings** exist against any of its Courts; if future bookings exist, soft-deletion is blocked until those bookings have passed or been cancelled.
- **AC5:** Given I configure my Branch's **payment method**, when I choose either **"No Payment / Pay Onsite"** or **"QR Code,"** then client bookings made at that Branch follow the corresponding flow (per Epic C3): Pay Onsite bookings auto-confirm immediately after phone verification with no payment collected online; QR Code bookings show the client a dynamically generated, amount-embedded PromptPay QR, require the client to transfer and upload a slip, and await Admin confirmation (per A2.3).
- **AC6:** Given my Branch's payment method is set to **QR Code**, when I configure my Branch's **PromptPay ID** (the Branch's PromptPay-registered phone number, national ID, or e-wallet ID) — **not** a static QR image — then the system uses that PromptPay ID to **dynamically generate a fresh, amount-embedded PromptPay QR code at the payment step of every booking** made at this Branch. There is still no payment gateway integration and no automatic payment verification — the dynamic QR only pre-fills the correct transfer amount for the client's convenience; slip upload and verification remain entirely manual (client uploads, Admin confirms/rejects).
- **AC7:** Given I change a Branch's payment method (e.g., from QR Code to Pay Onsite, or vice versa), when I save the change, then it applies to **new** bookings made from that point forward; bookings already in progress or already Confirmed under the previous method are not retroactively altered.

#### Epic A5 — Court Management (Schedule, Duration & Pricing)

**A5.1** — As an Admin/Owner (or Branch Admin, for their own Branch), I want to create, edit, deactivate, and soft-delete Courts, each assigned to one Branch and one Sport within my Tenant, and configure each Court's schedule, grid interval, max slots, and pricing, so that I control the actual bookable inventory and its rates.

- **AC1:** Given I create a new Court, when I save it, then I must assign exactly one Branch and one Sport (both within my Tenant). **A Branch Admin may only create/edit Courts within their own assigned Branch; Owner and Admin may do so for any Branch in the Tenant.**
- **AC2:** Given I edit a Court's Branch or Sport assignment, when I save changes, then the change is validated against any existing future bookings for that Court and does not retroactively corrupt historical bookings.
- **AC3:** Given I **deactivate** a Court (e.g., for maintenance, or permanently), when I confirm, then it can be done **at any time, regardless of existing future bookings** — it immediately stops accepting new bookings and no longer appears as bookable to clients for any future date; existing future Confirmed bookings are unaffected by deactivation alone and are surfaced to me for manual resolution if needed.
- **AC4:** Given I attempt to **soft-delete** a Court, when I confirm, then the system allows soft-deletion **only if the Court has no future bookings** (no bookings scheduled ahead of the current date/time in any active status); if future bookings exist, soft-deletion is blocked with a clear message, and I must wait until those bookings have passed (or been cancelled) before soft-deleting. **The intended workflow is: deactivate first → wait until all future bookings on that Court have passed → then soft-delete.**
- **AC5:** Given I need to block a Court for a specific date/time range (e.g., maintenance) without fully deactivating it, when I create a block, then those grid units show as unavailable to clients but the Court remains otherwise bookable.
- **AC6:** Given I configure a Court's **grid interval** (one value from the fixed set **{30, 60, 90, 120} minutes**) and its **max slots** (`maxSlots` ≥ 1), when I save, then the client-facing flow lays out that Court's start-time grid at the chosen interval and offers slot counts of 1..`maxSlots` (per C1.2) — no other grid spacing or larger span is supported. **Changing a Court's grid interval or max slots does not retroactively alter existing bookings** (they retain their original slots and snapshotted prices); it applies to new bookings only. The change is permitted **at any time, even while future bookings exist**, and must never create a double-booking: because every value in {30,60,90,120} is a multiple of 30, availability and double-booking prevention are tracked internally on a fixed 30-minute lattice (see NFR §Concurrency), so bookings made before and after a grid-interval change still cannot overlap. A `maxSlots` decrease never invalidates an existing longer booking; it only caps new ones.
- **AC7:** Given I configure a Court's **day-of-week schedule**, when I set specific open/close times for each day (or mark a day as fully closed), when I save, then the client-facing availability grid for that Court reflects these day-specific hours (per C1.1 AC4).
- **AC8:** Given I set a **base (normal) price per grid unit** for a Court, when an occupied grid unit's start time does not fall within any configured Peak Time Range, then that grid unit is charged at the base price.
- **AC9:** Given I define one or more **Peak Time Ranges** for a Court (each with its own start/end time, applicable day(s) of week, and override price per grid unit), when an occupied grid unit's start time falls within a configured Peak Time Range, then that grid unit is charged the Peak price instead of the base price.
- **AC10:** Given a booking spans multiple grid units that fall across both a Peak Time Range and the base/default range (e.g., a 90-minute booking on a 30-min-grid court starting off-peak and extending into peak hours), when the price is calculated, then it is the **sum of the per-grid-unit prices**: each occupied grid unit is priced at the base or Peak rate for the time range its **start** falls into, and the results are added together — **not** a single whole-booking rate. Peak-range membership is evaluated per grid unit by that unit's start time.

#### Epic A6 — Promotion Management

**A6.1** — As an Admin/Owner, I want to create and manage promo codes/discounts within my Tenant, so that I can drive bookings during off-peak times or run marketing campaigns.

- **AC1:** Given I create a Promotion with a discount type (percentage or fixed), validity window, and optional scope (Branch/Sport/Court within my Tenant), when I save it, then it becomes applicable to matching bookings within its validity window, for my Tenant's clients only.
- **AC2:** Given I set a usage limit (total uses and/or per-Member uses), when the limit is reached, then the Promotion is automatically no longer applicable, without manual intervention.
- **AC3:** Given I deactivate or expire a Promotion, when I do so, then it can no longer be applied to new bookings, and bookings already made with it (and their recorded Payment amounts) remain unaffected historically.
- **AC4:** Given I view Promotion usage, when I open its detail, then I can see how many times it has been used and on which bookings (including the resulting Payment amounts).

#### Epic A7 — Member Management

**A7.1** — As an Admin, I want to view and manage the list of Members (phone-based clients) within my Tenant, so that I can look up client history and handle support requests.

- **AC1:** Given I open Member management, when it loads, then I see a searchable list of Members (by phone number, and optional name/emergency contact/sex if collected) scoped to my Tenant only. **If I am a Branch Admin, I only see Members who have at least one booking at my assigned Branch; Owner and Admin see all Members Tenant-wide.**
- **AC2:** Given I select a Member, when I view their profile, then I see their full booking and payment history across my Tenant's branches (or, if I am a Branch Admin, limited to bookings at my Branch) — never another Tenant's data, even if the same phone number exists there.
- **AC3:** Given I need to block a Member (e.g., repeated no-shows/abuse), when I mark them as blocked, then that phone number cannot complete new bookings within my Tenant (OTP requests may still be rate-limited/blocked, per policy) until unblocked. Blocking has no effect on that phone number's Member record in any other Tenant.

#### Epic A8 — Admin Configuration & Branding

**A8.1** — As an Owner/Admin, I want to configure system/tenant-level settings, so that the booking rules match how my venue actually operates.

- **AC1:** Given I set default business-hours templates at the Tenant level, when I save, then new Courts inherit these defaults unless overridden at the Court level (per A5.1).
- **AC2:** Given I set a default grid interval, default max slots, and a default base/peak pricing template at the Tenant level, when a new Court is created, then it inherits these Tenant defaults unless overridden at the Court level (per A5.1 AC5-AC8).
- **AC3:** Given I set a minimum booking lead time and/or maximum advance booking window, when a client attempts to book outside these bounds, then the relevant grid units are shown as unavailable/not selectable.
- **AC4:** Given I set a cancellation policy (e.g., cutoff hours before slot start), when a client or admin attempts to cancel, then the policy is enforced consistently in both the client and admin flows.
- **AC5:** Given I set OTP-related rules (expiry duration, max attempts, resend cooldown), when the OTP flow runs, then it enforces exactly these configured values.
- **AC6:** Given I configure my Tenant's **Hold window**, when I choose either **5 minutes or 10 minutes** (the only two allowed values in MVP), then the system enforces exactly that duration for the slot Hold, covering the time from slot selection through OTP verification (if required) through slip upload.

**A8.2** — As an Owner, I want to upload my Tenant's logo and set brand color(s), so that our public News Feed and booking pages reflect our venue's identity.

- **AC1:** Given I upload a logo image and set one or more CI colors in Admin Config, when I save, then these are stored as my Tenant's Branding settings and applied to my Tenant's public News Feed (C0.1 AC4) and booking pages.
- **AC2:** Given a Tenant has not yet configured branding, when its public pages are shown, then a neutral/default appearance is used until branding is configured.
- **AC3:** Given I update branding, when saved, then the change is reflected on the next load of the public site.

#### Epic A9 — Admin Roles & Access (Owner / Admin / Branch Admin)

**A9.1** — As a Tenant, I want three defined admin roles — Owner, Admin, and Branch Admin — so that access can be appropriately delegated within my Tenant.

- **AC1:** Given a Tenant is provisioned, when its first AdminUser is created, then that account is assigned the **Owner** role: full access to every module and every Branch within the Tenant, and it **cannot be removed or revoked** by any other AdminUser.
- **AC2:** Given the Owner creates an **Admin**-role AdminUser, when that account is created, then it has full access to every module and every Branch within the Tenant — identical to Owner — **except** that the Owner can remove/revoke this Admin account at any time (an Admin cannot remove/revoke another Admin or the Owner).
- **AC3:** Given the Owner or an Admin creates a **Branch Admin**-role AdminUser scoped to one specific Branch, when that staff member logs in, then they can access only that Branch's **bookings, members, and courts** — no visibility into or action on any other Branch's data, even within the same Tenant, and no access to Tenant-wide modules (Sport catalog, Promotions, Config, Branding, other Branches) beyond what A2/A5/A7 explicitly allow at their own Branch.
- **AC4:** Given a Branch Admin attempts to access another Branch's data (e.g., via a direct link to a different Branch's booking), when attempted, then access is denied.
- **AC5:** Given an Owner or Admin account, when they access any module (Sport/Branch/Court/Promotion/Member/Config/News/Branding management, or bookings across any Branch), then they have full, Tenant-wide access (not Branch-scoped).

#### Epic A10 — News/Announcement Management

**A10.1** — As an Admin/Owner, I want to create, edit, publish/unpublish, and delete Announcements (News posts) for my Tenant, so that I can communicate updates and promotions to clients on the public News Feed.

- **AC1:** Given I create an Announcement with a title, body text, and optional image, when I save it as Published, then it appears in my Tenant's public News Feed, ordered newest first.
- **AC2:** Given an Announcement is saved as a draft/unpublished, when I view the public News Feed, then it does **not** appear there.
- **AC3:** Given I edit a published Announcement, when I save changes, then the update is reflected on the public feed.
- **AC4:** Given I delete an Announcement, when I confirm deletion, then it is removed from the public feed (Announcements have no relationship to booking history, so this has no effect on bookings/payments).

---

## 6. Scope (MVP)

The following are confirmed in-scope, hard requirements for MVP:

1. **Multi-tenancy (hard requirement):** Tenant is a first-class entity; every Branch, Sport, Court, Slot, Booking, Member, Client Session, Promotion, Payment, News/Announcement, Config, and AdminUser belongs to exactly one Tenant, with strict data isolation enforced across tenants at all times. **Confirmed: one Tenant may operate many Branches** (self-service tenant onboarding/signup remains out of scope — see Section 7; tenants are provisioned manually by internal platform operations).
2. **Client booking flow:** Branch → Sport → Court → start time (on the Court's grid) → slot-count selection, with real-time availability.
3. **Per-Court configurable grid:** each Court's admin sets a **grid interval** (the atomic slot size) from the fixed set **{30, 60, 90, 120} minutes** — which defines that Court's start-time grid spacing — plus a **max slots** cap; a booking spans 1..`maxSlots` contiguous grid units.
4. **Per-Court schedule & pricing:** day-of-week open/closed schedule and hours, a base price, and one or more Peak Time Range price overrides per Court, with mixed-range bookings priced as the **sum of the per-range portions**.
5. **Dual login methods with a long-lived session:** clients may log in via phone+OTP or via LINE login; the resulting Client Session is long-lived and covers browsing/history/profile. **A Member's phone is verified via SMS OTP once** — at phone+OTP login, or as a one-time capture-and-bind step for a LINE-login account with no phone on file at first booking — after which no further OTP is required for that Member's future bookings while logged in.
6. **Manual payment via bank-transfer slip upload (hard requirement, no payment gateway):** client uploads a slip image; an Admin manually reviews and confirms or rejects it; Booking status and Payment status are tracked separately; a Booking reaches Confirmed only after Admin payment confirmation; unpaid (no-slip) holds automatically expire and release the slot, while slip-uploaded-but-unreviewed bookings remain reserved pending Admin action. **This flow applies only to Branches configured for "QR Code" payment (see item 6a below).**
   6a. **Per-Branch payment method setting:** each Branch has an admin/owner-configurable payment method — **"No Payment / Pay Onsite"** (booking auto-confirms after phone verification, with no payment collected online; client pays at the venue) or **"QR Code"** (the manual slip-upload-and-admin-confirm flow in item 6, using a **dynamically generated PromptPay QR** — built at the payment step of each booking from the Branch's configured PromptPay ID, with the booking's exact amount embedded so it pre-fills in the client's banking app). Still no payment gateway integration or automatic payment verification in MVP under either option — dynamic QR generation is a convenience (correct amount pre-filled), not auto-confirmation; the client still uploads a slip and an Admin still manually confirms/rejects it.
7. **Public News Feed** as the Tenant's default public landing page, with admin CRUD for Announcements, and a clear path from the feed into the booking flow.
8. **Tenant Branding:** logo + CI color(s), configurable per Tenant and applied to public News Feed/booking pages (light white-label).
9. **Mobile-first client experience** (design/build priority for the public/client side).
10. **Booking finalize flow**, including handling of race conditions during slot hold, OTP, and slip upload/review.
11. **Client profile:** optional Member fields (name, emergency contact, sex), editable any time via a profile screen, never required to complete a booking.
12. **Client booking history**, accessible via an active login session (phone+OTP or LINE), scoped to the Tenant, including booking and payment status.
13. **Self-service cancellation requests:** a client may request cancellation of a Confirmed booking up to 2 hours before its start time; the request requires Admin approval before the booking is actually Cancelled; refunds (if any) are handled manually/off-platform.
14. **Admin calendar view** of bookings across courts/time, filterable by Branch, showing booking and payment status, scoped to the Tenant (and to the assigned Branch for Branch Admins).
15. **Admin booking list** with search/filter (including payment status and cancellation-request status) and manual create/modify/cancel/status-update capability, scoped to the Tenant (and Branch, for Branch Admins).
16. **Admin payment confirmation queue:** review uploaded slips and confirm/reject them.
17. **Admin cancellation-request queue:** review client-submitted cancellation requests and approve/decline them.
18. **Staff/admin walk-in booking creation that skips OTP** (auditable override), with the option for the Admin to directly confirm payment (e.g., cash) without a slip.
19. **Sport management** (CRUD, deactivate anytime, soft-delete only when no future bookings exist), scoped to the Tenant.
20. **Branch management** (CRUD, deactivate anytime, soft-delete only when no future bookings exist, business hours; explicitly supports many Branches per Tenant), scoped to the Tenant.
21. **Court management** (CRUD, one Branch + one Sport per Court, deactivate anytime, soft-delete only when no future bookings exist, maintenance blocking, per-Court durations/schedule/pricing), scoped to the Tenant (and Branch, for Branch Admins).
22. **Promotion management** (CRUD promo codes, validity window, usage limits, scoping), scoped to the Tenant.
23. **Member management** (list/search Members, view history, block/unblock, view optional profile fields), scoped to the Tenant (and Branch, for Branch Admins).
24. **Three admin roles:** Owner (full access, cannot be removed), Admin (full access, removable by Owner), and Branch Admin (scoped to one Branch's bookings/members/courts only).
25. **Admin config** for business hours, per-Court duration/schedule/pricing defaults, booking lead-time/advance-window rules, cancellation policy (2-hour self-cancel cutoff), OTP rules, the Tenant's Hold window (5 or 10 minutes, admin's choice), and the Client Session default duration, scoped to the Tenant.
26. **Prevention of double-booking** under concurrent access — including during the OTP and slip-upload/pending-review window — as a hard functional requirement.
27. **Notifications:** OTP delivered via SMS, required once per Member to verify their phone (not on every booking); separate booking/payment/cancellation status notifications delivered via LINE Official Account (LINE OA) only to clients who have bound/linked their LINE OA.
28. **Thailand-only scope:** Thai phone number validation, THB currency for all pricing.

## 7. Out of Scope / Future (Non-Goals for v1)

The following are explicitly **not** in MVP unless an Open Question below is resolved to bring them in:

- **Self-service tenant onboarding/signup and billing/subscription management for tenants** — multi-tenancy itself (the data model and isolation) **is** in MVP (see Scope), but a venue operator signing themselves up, or in-platform billing/subscription management, is out of scope for v1; tenants are provisioned manually by the platform's internal operations team.
- **Payment gateway integration / automatic payment verification of any kind** (PromptPay QR auto-verification/webhook confirmation, card payments, e-wallets, automated bank-API reconciliation, etc.) — explicitly out of scope for v1. MVP does dynamically **generate** a PromptPay QR (with the amount embedded, per Scope item 6a) purely as a convenience for the client, but it does **not** verify or auto-confirm that payment — confirmation is always a **manual bank-transfer slip upload + Admin confirmation** flow, by confirmed design (not a gap).
- **Automated online refund processing** — since there is no payment gateway, refunds on cancellation are handled manually by an Admin, off-platform, by confirmed design (not a gap requiring resolution).
- **Native mobile apps** — v1 is a responsive, mobile-first web application only (booking + admin); no iOS/Android apps. (The public side is mobile-first web, not a native app.)
- **Player-to-player matchmaking / marketplace / social features** — explicitly out of scope; this is a booking tool, not a marketplace like Playtomic.
- **Recurring/series bookings** (e.g., "book this court every Tuesday for 8 weeks") — out of scope for v1; each booking is a single slot/date.
- **Waitlists** for fully booked slots — out of scope for v1.
- **Loyalty/points programs** beyond simple promo codes — out of scope for v1.
- **Multi-region / multi-currency / international phone-number support** — v1 is confirmed **Thailand-only** (Thai phone numbers, THB currency); international support is future scope.
- **Multi-language / full i18n localization** of content — out of scope for v1 beyond what's noted in Non-Functional Requirements.
- **Equipment/coach/lesson booking** (add-ons beyond court time) — out of scope for v1.
- **Advanced analytics/BI dashboards** (utilization heatmaps, revenue forecasting) beyond basic counts needed for success metrics — out of scope for v1.
- **Non-OTP notification channels other than LINE OA** (e.g., email, WhatsApp for confirmations/receipts) — out of scope for v1. (Note: OTP itself is always SMS, not LINE OA and not a "notification" in this sense — see Domain Glossary.)
- **Login methods beyond phone+OTP and LINE login** (e.g., email/password, Google/Facebook login, Apple ID) — out of scope for v1.
- **Sub-30-minute booking granularity** (e.g., 15-minute slots), or booking durations outside the fixed {30, 60, 90, 120}-minute set — out of scope for v1.
- **Hard/permanent deletion of Sports, Branches, or Courts** — only deactivation and soft-delete (once no future bookings remain) are supported in v1; irreversible hard deletion is out of scope.

## 8. Non-Functional Requirements

1. **Double-booking prevention (concurrency):** The system must guarantee that any overlapping time span on a Court can be reserved by at most one in-progress-or-further booking at any time — across the Hold, OTP/session, slip-upload, and Pending-Payment-Confirmation stages — even under concurrent booking attempts, **and even across a change to that Court's grid interval**. Because every allowed grid interval ({30,60,90,120} min) is a multiple of 30, availability and reservation are tracked internally on a **fixed 30-minute lattice** (each booking occupies `duration ÷ 30` lattice units); this decouples the lock granularity (always 30 min) from the Court's configurable grid interval, so two bookings created under different grid intervals still cannot overlap. This must hold under load testing simulating multiple simultaneous clients attempting to book the same grid units; exactly one proceeds through to Confirmed, and all others are cleanly rejected with a clear message.
2. **Slot Hold across verification and payment-declaration:** The contiguous grid units selected for a booking attempt must be Held (unavailable to other clients) from the start of slot selection through: (a) SMS OTP phone verification, **only if the booking Member does not already have a verified phone number** on their Member record (per C2.2/C2.3 — this is a one-time-per-Member step, not a per-booking step once verified), and — **only if the Branch's payment method is "QR Code"** — (b) upload of a payment slip. **If the Branch's payment method is "No Payment / Pay Onsite," there is no payment window at all: the Hold only needs to cover slot selection through phone verification, and the Booking auto-confirms immediately once verification succeeds (per C3.0/C3.3) — the grid units move directly from Held to Booked (Confirmed) with no intermediate payment-pending stage.** For **QR Code** Branches, the Hold window is a **Tenant-level setting, restricted to either 5 or 10 minutes** (the only two allowed values in MVP). If phone verification (when required) and slip upload are not both completed within the Hold window, the Hold expires, the grid units release to Available, and the Booking is marked Expired. **Once a slip is uploaded within the Hold window, the Booking moves to "Pending Payment Confirmation" and its grid units remain reserved** (held/booked, not Available to others) for as long as it takes an Admin to review — there is no additional automatic timeout on the admin-review stage in MVP; the slot is released only if the Admin explicitly rejects the payment.
3. **OTP security:**
   - OTP codes are delivered via **SMS only** (never LINE OA), are single-use, and expire after a configurable window.
   - OTP requests must be rate-limited per phone number to prevent abuse (both resend cooldown and a cap on sends within a rolling window).
   - Failed verification attempts must be capped per OTP/session to prevent brute-force guessing.
   - No booking may reach Confirmed status unless the booking Member's phone number is verified — either previously (persisted on the Member record from a prior phone+OTP login or one-time LINE-account phone-binding) or via a fresh, successful, unexpired SMS OTP verification completed within this booking attempt (also captured as functional AC in Epic C2). A logged-in client with an already-verified phone is **not** required to re-verify per booking.
4. **Tenant data isolation (hard requirement):** Every Branch, Sport, Court, Slot, Booking, Member, Client Session, Promotion, Payment (including uploaded slip images), News/Announcement, Config, and AdminUser is scoped to exactly one Tenant. No Tenant's data may ever be visible, queryable, or modifiable by another Tenant's admin users or exposed through another Tenant's client-facing flow. This must hold even on shared infrastructure. Any cross-tenant data leakage is treated as a critical-severity defect.
5. **Payment/booking status integrity (manual payment model):** Since MVP has no payment gateway, the system must ensure: (a) at a **QR Code** Branch, a Booking cannot reach Confirmed status unless its Payment status is Confirmed by an explicit Admin action (via slip review, or direct confirmation for staff-created walk-in bookings per A2.2 AC3); (b) at a **Pay Onsite** Branch, a Booking reaches Confirmed status automatically upon successful phone verification, with its Payment status set to "Pay Onsite / Not Collected Online" — no Admin action is required or expected for this path; (c) uploaded slip images are stored and retrievable only within their associated Booking and visible only to Admin users of the correct Tenant (tenant data isolation extends to payment slip images); (d) the amount recorded is always derived correctly from the Court's base/peak pricing for the selected time range and duration, minus any valid Promotion, in THB, regardless of payment method; (e) every payment confirmation/rejection action (QR Code path) is attributable to a specific Admin and timestamped for audit purposes; (f) the system never applies QR-Code-path logic (slip requirement, Admin review) to a Pay Onsite booking, or vice versa.
6. **Slot-grid and slot-count integrity:** All bookable start times must align to the Court's configured grid interval (one of {30, 60, 90, 120} minutes), and every booking's slot count must be an integer in the range 1..`maxSlots` for that specific Court, occupying only contiguous grid units; the system must enforce this server-side for both client-created and admin-created bookings, not merely present it in the interface.
7. **Availability/uptime:** The client booking flow and admin console should target high availability during business hours of the venues using the platform (specific SLA target to be confirmed — see Open Questions).
8. **Auditability:** All booking status changes (created, verified, slip uploaded, payment confirmed/rejected, confirmed, modified, cancelled, no-show, completed) and all admin CRUD actions (Sports/Branches/Courts/Promotions/News/Branding) should be attributable (which admin/system action) and traceable for support/dispute resolution, within the Tenant's own audit trail.
9. **Phone number handling (Thailand-only in MVP):** The system validates and expects **Thai mobile phone numbers only** in MVP; international phone number formats are not required to be supported in v1. All pricing and payment amounts are in **THB**.
10. **Data retention for historical integrity:** Deactivating/deleting a Sport, Branch, or Court must not corrupt or delete historical booking or payment records; historical bookings must remain queryable/reportable even after the referenced entity is deactivated.
11. **Localization readiness:** While full translated UI and multi-region support are out of scope for v1 (Section 7), the system should not hard-code assumptions that would block adding languages/currencies/regions/notification channels later — a "don't paint ourselves into a corner" requirement, not a v1 feature commitment.
12. **Notification delivery (OTP = SMS; status notifications = LINE OA, binding-gated):** OTP codes are delivered via **SMS** to the client's phone number whenever phone verification is required — i.e., at phone+OTP login, or the one-time capture-and-bind step for a LINE-login Member without a verified phone; **not** on every booking once a Member's phone is verified. SMS is the sole OTP channel in MVP; LINE OA is never used for OTP delivery. Separately, non-OTP booking/payment/cancellation status notifications (slip received, payment confirmed/rejected, booking confirmed/cancelled, cancellation request approved/declined) are delivered via **LINE Official Account (LINE OA)** messaging, but **only to clients who have bound/linked their LINE OA account**; if a client has not linked LINE OA, no LINE notification is sent to them for these events (on-screen/in-app status remains available regardless of LINE-binding state; a fallback notification channel for unbound clients is a minor, non-blocking item for MVP). Both SMS OTP delivery and LINE OA notification delivery must be reliable enough to meet the metrics in Section 2; failures must be surfaced to the client with a retry path rather than silently failing.
13. **Mobile-first client experience:** The public/client-facing experience (News Feed, booking flow, OTP/login, slip upload, booking history) must be designed and built **mobile-first**, since the large majority of end clients are expected to use a mobile browser. The Admin Console is primarily desktop-oriented and does not need to be mobile-optimized, but should remain usable on smaller/tablet screens.
14. **Role-based access control (Owner / Admin / Branch Admin):** The system must enforce the three-role model at every layer (not just the UI): Owner (full Tenant access, non-removable), Admin (full Tenant access, removable by Owner), and Branch Admin (strictly limited to their assigned Branch's bookings, members, and courts). A Branch Admin's access must be denied server-side for any data outside their assigned Branch, even if a request is crafted directly (e.g., via a booking ID belonging to another Branch).

## 9. Open Questions

Nearly every prior open question has now been resolved by the Owner and is reflected as a hard MVP requirement throughout this PRD, including: multi-tenancy (incl. multi-branch), the per-court fixed-duration-set slot model, dual login methods (phone+OTP or LINE) with phone verified via SMS OTP **once per Member** (not on every booking) and no OTP thereafter for that Member's bookings while logged in, SMS as the sole OTP channel, LINE OA for status notifications only (gated on binding), long-lived (configurable) login sessions, the public News Feed, mobile-first design, richer per-court schedule/pricing with mixed-range pricing as a sum of portions, the manual bank-transfer-slip payment model, staff walk-in bookings skipping OTP, the Tenant Hold-window setting (5/10 min), self-service cancellation requests (2-hour cutoff, admin-approved), manual/off-platform refunds, three admin roles (Owner/Admin/Branch Admin) with defined scoping, the Court deactivate-then-soft-delete lifecycle, optional Member profile fields (name, emergency contact, sex), and Thailand-only region/currency scope. Only the following remain genuinely open:

1. **Numeric configuration defaults:** Confirm exact values for (a) OTP expiry window, max verification attempts, and resend cooldown/cap, and (b) the default Client Session duration (confirmed to be "long-lived, e.g., weeks/months" and configurable, but no exact default value has been set).
2. **Business model / success metric ownership:** Please confirm or adjust the illustrative numeric targets in Section 2 (booking completion rate, OTP success rates, payment-slip review turnaround, etc.) — these were proposed by the analyst and need business sign-off.

---

## Handoff Notes (for UI/UX Designer and Solution Architect)

- This PRD defines **what** must be true, not how screens look or how data is stored. Please treat Section 5 acceptance criteria as the testable contract for the test agent.
- **UI/UX design scope covers both sides of the product:** the public/client mobile-first experience (News Feed, booking flow, login, OTP, slip upload, booking history, profile) **and** the (desktop-oriented) Admin Console (calendar, booking list, payment/cancellation-request queues, Sport/Branch/Court/Promotion/Member/News/Branding/Config management, and role-based views for Owner/Admin/Branch Admin).
- MVP payment is a manual bank-transfer slip upload reviewed by an Admin — not a payment gateway — with Booking status and Payment status tracked as two separate state machines that only converge at Confirmed. Please design/architect the booking lifecycle around: slot Hold → phone verification via SMS OTP (**only if the Member's phone isn't already verified** — see below) → slip upload → Admin payment review → Confirmed, with each stage's state and failure/expiry path made explicit.
- **Login vs. phone verification is an important distinction — please do not conflate them:** clients may establish a long-lived login session via phone+OTP or via LINE login, and that session is sufficient for browsing the News Feed, viewing booking history, and editing their profile. **Phone verification via SMS OTP happens once per Member, not on every booking:** phone+OTP login verifies the phone as part of logging in; a LINE-login client with no phone on file is prompted for phone + OTP **once** (at their first booking, or whenever they choose to add a phone), which permanently binds and verifies that phone to their account. Once a Member's phone is verified, all of that Member's future bookings (while logged in) skip the OTP step entirely — OTP is never required again for that Member. OTP is always delivered via SMS — never via LINE OA.
- LINE OA is used for two things only: (1) LINE login (an alternative to phone+OTP for establishing a session), and (2) non-OTP status notifications (payment confirmed/rejected, cancellation approved/declined, etc.) — and only to clients who have bound/linked their LINE OA account. Please confirm the LINE OA integration/binding UX with the architect.
- The public site's information architecture starts at a **News Feed**, with booking as a secondary, clearly-reachable action — not the reverse.
- Per-Court configuration is rich: a **grid interval** (the atomic slot size, one of {30,60,90,120} min, which sets the court's start-time grid spacing), a **max slots** cap (max contiguous grid units per booking), a day-of-week open/close schedule, a base price per grid unit, and one or more Peak Time Range price overrides. Mixed-range bookings are priced as the **sum of the per-grid-unit prices** — each unit at the base or peak rate for the range its start falls into (confirmed rule — see A5.1 AC10) — please implement this pricing calculation precisely, as it is a common real-world case (bookings crossing into peak hours).
- Multi-tenancy (including data isolation) and multi-branch-per-tenant are core, load-bearing architectural requirements. Tenant Branding (logo + CI colors), applied to the public News Feed and booking pages, is a distinct, per-tenant configuration surface. The three-role model (Owner/Admin/Branch Admin) must be enforced server-side, not just in the UI.
- Court lifecycle is deactivate-then-soft-delete: deactivation is allowed at any time; soft-deletion is blocked while any future bookings exist on that Court (the same pattern is assumed, by analogy, for Branch and Sport).
- **Per-Branch payment method.** Each Branch is independently configured as "No Payment / Pay Onsite" or "QR Code" (never both, never a mix, per Branch at any given time). This forks the booking lifecycle after phone verification: Pay Onsite goes straight to Confirmed with a distinct "Pay Onsite / Not Collected Online" payment status and no Admin step; QR Code continues into the existing slip-upload-and-Admin-review flow. Please design both paths explicitly (including in the Admin Console's booking list/calendar/slip-review queue, which must not surface Pay Onsite bookings as needing payment review) — still no payment gateway integration in either case.
- **Important correction on the QR Code path:** the QR is **not** a static uploaded image. The Branch configures its **PromptPay ID** only (phone number / national ID / e-wallet ID); at the payment step of each individual booking, the system **dynamically generates a fresh PromptPay QR (standard Thai PromptPay/EMVCo payload) with that booking's exact amount due embedded**, so it pre-fills correctly in the client's banking app. This is purely a convenience feature — it does **not** provide any automatic payment verification. The client still transfers manually, uploads a slip image, and an Admin still manually confirms/rejects it, exactly as before. Please architect the QR generation as a per-booking, on-demand step (amount depends on duration, base/peak pricing, and any applied promo — see A5.1 AC10), not a one-time static asset per Branch.
- Self-service cancellation is now in scope as a **request-and-approve** flow (client requests up to 2 hours before start; Admin approves/declines) — not a fully automated client-side cancel.
- Region scope is Thailand-only for v1 (Thai phone number format, THB currency) — do not build in assumptions requiring international support for MVP, though Section 8's localization-readiness NFR still asks that the design not preclude it later.
- Very few Open Questions remain (Section 9): only exact numeric defaults (OTP expiry/attempts/resend, Client Session default duration) and business sign-off on the illustrative success-metric targets. This PRD is otherwise ready to be treated as the stable basis for design and architecture work.
- The Domain Glossary (Section 4) is intended to give both downstream teams a shared vocabulary; entity relationships (Tenant → many Branches → Court, Court → one Sport, Booking → one Member with a verified phone (verified once, not per booking), Booking → one Payment via manual slip review, all entities → exactly one Tenant) should be treated as fixed conceptual constraints even though exact data modeling is the architect's decision.

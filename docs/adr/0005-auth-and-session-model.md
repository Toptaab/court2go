# ADR-0005: Auth & session model — two actor types, DB-backed sessions

## Status
Accepted

## Context
Two distinct principal types interact with the system with very different auth flows: **Members** (clients), who log in via phone+OTP or LINE login and get a long-lived, Tenant-configurable session (PRD Epic C2), and **AdminUsers** (staff), who need role/branch-scoped access (Owner/Admin/Branch Admin) with server-enforced boundaries (PRD Epic A9). Neither the login mechanism for AdminUser nor the session storage strategy is specified by the PRD (the PRD's "no login methods beyond phone+OTP/LINE" scope note applies to Members, not staff) — both need an architect decision.

Two hard requirements push the session storage choice: (1) blocking a Member (A7.1 AC3) must make them immediately unable to book — "immediately" is hard to guarantee with pure stateless JWT without a blacklist, which just reintroduces server-side state anyway; (2) removing/deactivating an AdminUser (Owner removing an Admin, or a Branch Admin being deactivated) must revoke their access immediately, not wait out a token's remaining lifetime.

## Decision
- **Session storage:** DB-backed opaque sessions for both actor types — `ClientSession` (Member) and `AdminSession` (AdminUser) — not stateless JWTs. A session is looked up by its opaque id on every request; `revokedAt`/`expiresAt` are checked server-side, giving instant revocation for both the "block Member" and "remove/deactivate AdminUser" cases as a direct consequence of the storage choice, not extra machinery bolted on.
- **Two separate mechanisms, never conflated:** distinct tables, distinct cookie names (`c2g_member_session` / `c2g_admin_session`), distinct guard stacks. A session for one actor type is structurally meaningless to the other type's endpoints.
- **Member session ↔ tenant binding:** `ClientSession.tenantId` is checked against the tenant resolved from the current request on every use — a session minted while browsing one Tenant's site is inert on another Tenant's site even served from the same shared domain (no need for per-tenant cookie names for this to hold).
- **AdminUser login mechanism:** email + password (bcrypt/argon2 hash), since the PRD leaves this open and AdminUsers are provisioned by internal ops / other AdminUsers, not self-serve — a conventional credential login is the lowest-risk default and is isolated behind its own module/table, so it can be swapped for SSO later without touching the Member-auth code at all.
- **Role/branch scope is read server-side from `AdminUser` on every request** (`role`, nullable `branchId`), never trusted from a client-supplied claim; `RolesGuard` and `BranchScopeGuard` (NestJS guards) enforce it on every admin controller, including denying access to another Branch's resource even via a directly-crafted URL/ID (PRD A9.1 AC4).
- **Owner/Admin removal rules are enforced in the service layer**, not just the UI: `AdminUsersService.remove()` refuses to remove an `OWNER`-role target under any actor, and refuses an `ADMIN`-role target unless the actor is the `OWNER`.

## Consequences
- Every authenticated request costs a session-table lookup (indexed on the opaque id) instead of pure token verification — an acceptable, standard trade for instant revocation; no separate token-blacklist infrastructure is needed as a result.
- Horizontal scaling of `apps/api` is unaffected (session state lives in Postgres, not in-process memory).
- Two parallel session mechanisms is slightly more code than a single unified "User" auth system, but it removes an entire class of bug (a Member session accidentally granting admin-console access, or vice versa) by construction rather than by convention.
- The AdminUser email+password decision is a documented assumption filling a genuine PRD gap; low blast-radius to revisit later since it's fully isolated behind the `AdminUser`/`AdminSession` boundary and touches nothing on the Member side.

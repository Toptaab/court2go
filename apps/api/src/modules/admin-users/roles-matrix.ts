import type { RolesMatrix } from '@repo/types';

/**
 * Declarative capability grid (DESIGN D16) the admin UI renders. This is a
 * PRESENTATIONAL mirror of the server-enforced RBAC (ADR-0005) — the guards +
 * `assertBranchScope` remain the source of truth; keep the two in sync.
 * Branch Admin's `true`s are always additionally branch-scoped at runtime.
 */
export const ROLES_MATRIX: RolesMatrix = {
  roles: ['OWNER', 'ADMIN', 'BRANCH_ADMIN'],
  capabilities: [
    { key: 'view_all_branches', label: 'View all branches', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: false } },
    { key: 'manage_branches', label: 'Create / edit branches', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: false } },
    { key: 'manage_sports', label: 'Create / edit sports', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: false } },
    { key: 'manage_courts', label: 'Create / edit courts', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: true } },
    { key: 'manage_bookings', label: 'Manage bookings', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: true } },
    { key: 'review_payments', label: 'Confirm / reject payments', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: true } },
    { key: 'manage_members', label: 'View / block members', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: true } },
    { key: 'manage_promotions', label: 'Create / edit promotions', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: false } },
    { key: 'manage_news', label: 'Create / edit news', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: false } },
    { key: 'manage_config', label: 'Edit config & branding', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: false } },
    { key: 'manage_admin_users', label: 'Manage admin users', allowed: { OWNER: true, ADMIN: true, BRANCH_ADMIN: false } },
  ],
};

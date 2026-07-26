import { SetMetadata } from '@nestjs/common';
import type { Role } from '@repo/types';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given `AdminUser.role`s (ARCHITECTURE §3.3).
 * Must be paired with `RolesGuard`, which runs AFTER `AdminSessionGuard`
 * (reads `req.adminAuth.adminUser.role`). Absence of this decorator on a
 * route is a no-op for `RolesGuard` (allow), so `RolesGuard` can safely sit
 * globally on a controller alongside routes that don't need role narrowing.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

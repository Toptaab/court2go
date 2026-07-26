import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@repo/types';
import { ApiError } from '../../common/api-error';
import type { RequestWithAdminAuth } from './admin-session.guard';
import { ROLES_KEY } from './roles.decorator';

/**
 * RBAC guard (ARCHITECTURE §3.3). MUST run after `AdminSessionGuard` — it
 * reads `req.adminAuth.adminUser.role`, which only `AdminSessionGuard` sets.
 * No `@Roles(...)` metadata present on the handler/class ⇒ allow (no-op),
 * so this guard can be applied broadly without over-restricting routes that
 * don't need role narrowing.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithAdminAuth>();
    const role = req.adminAuth?.adminUser.role;
    if (!role || !required.includes(role as Role)) {
      throw ApiError.forbidden('You do not have permission to perform this action', 'FORBIDDEN');
    }
    return true;
  }
}

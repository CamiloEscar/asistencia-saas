import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_METADATA_KEY, type RoleName } from '../../presentation/decorators/roles.decorator'

/**
 * RolesGuard — enforces `@Roles(Role.X)` metadata on handlers.
 *
 * - Reads the metadata set by the `@Roles()` decorator.
 * - If absent, the route is open to any authenticated user (the JwtAuthGuard
 *   still ran, so we know the user is authenticated).
 * - If present, compares against `req.user.role`. Mismatch → 403.
 *
 * Runs AFTER JwtAuthGuard so `req.user` is always populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[] | undefined>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const req = context.switchToHttp().getRequest<{ user?: { role?: string } }>()
    const role = req.user?.role
    if (!role || !required.includes(role as RoleName)) {
      throw new ForbiddenException({ message: 'Insufficient permissions' })
    }
    return true
  }
}

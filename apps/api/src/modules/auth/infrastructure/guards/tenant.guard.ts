import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { ForbiddenException, Injectable } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../../presentation/decorators/public.decorator'
import { getTenantContext } from '../../../../shared/tenant/tenant.context'

/**
 * TenantGuard — verifies the JWT's `institutionId` claim matches the
 * tenant resolved by TenantMiddleware for the current request.
 *
 * This is the chokepoint that prevents a token from institution X being
 * replayed against institution Y's endpoints (REQ-TENANT-007-03).
 *
 * Behavior:
 *   - Routes marked with `@Public()` skip this guard entirely. The
 *     project's contract is that `@Public()` = "no JWT required", so
 *     there's no JWT `institutionId` to compare against — attempting to
 *     do so produces a spurious 403 on login, refresh, set-password,
 *     forgot-password, etc.
 *   - Unauthenticated requests (no `req.user`) on non-public routes pass
 *     through. JwtAuthGuard runs BEFORE this guard in the global chain
 *     and would have already 401'd — this branch is purely defensive in
 *     case guard order ever changes.
 *   - SUPER_ADMIN (institutionId null) is allowed to cross tenants —
 *     they're expected to use the super-admin endpoints.
 *   - For all other roles, the JWT's institutionId MUST equal the
 *     tenant context's tenantId. Mismatch → 403 (or 404 for read paths
 *     that prefer not to leak existence — controller chooses).
 *
 * Runs AFTER JwtAuthGuard so `req.user` is populated for non-public routes.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<{
      user?: { institutionId?: string | null; role?: string }
    }>()
    if (!req.user) return true

    const ctx = getTenantContext()
    if (!ctx) {
      // Should never happen — TenantMiddleware ran first. Fail closed.
      throw new ForbiddenException({ message: 'Tenant context missing' })
    }
    if (req.user.role === 'SUPER_ADMIN') return true
    if (req.user.institutionId === ctx.tenantId) return true
    throw new ForbiddenException({ message: 'Tenant mismatch' })
  }
}

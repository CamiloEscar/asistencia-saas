import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { getTenantContext } from '../../../../shared/tenant/tenant.context'

/**
 * TenantGuard — verifies the JWT's `institutionId` claim matches the
 * tenant resolved by TenantMiddleware for the current request.
 *
 * This is the chokepoint that prevents a token from institution X being
 * replayed against institution Y's endpoints (REQ-TENANT-007-03).
 *
 * Behavior:
 *   - SUPER_ADMIN (institutionId null) is allowed to cross tenants —
 *     they're expected to use the super-admin endpoints.
 *   - For all other roles, the JWT's institutionId MUST equal the
 *     tenant context's tenantId. Mismatch → 403 (or 404 for read paths
 *     that prefer not to leak existence — controller chooses).
 *
 * Runs AFTER JwtAuthGuard so `req.user` is populated.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { institutionId?: string | null; role?: string }
    }>()
    const ctx = getTenantContext()
    if (!ctx) {
      // Should never happen — TenantMiddleware ran first. Fail closed.
      throw new ForbiddenException({ message: 'Tenant context missing' })
    }
    if (req.user?.role === 'SUPER_ADMIN') return true
    if (req.user?.institutionId === ctx.tenantId) return true
    throw new ForbiddenException({ message: 'Tenant mismatch' })
  }
}

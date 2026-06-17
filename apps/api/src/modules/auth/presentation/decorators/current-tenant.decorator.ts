import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'
import type { ResolvedTenant } from '../../../../shared/tenant/tenant-resolver.service'

/**
 * `@CurrentTenant()` — extracts the tenant resolved by TenantMiddleware
 * for the current request. Returns the `ResolvedTenant` shape (id,
 * subdomain, status, timezone).
 *
 * Usage:
 *   @Get('me')
 *   me(@CurrentTenant() tenant: ResolvedTenant) { ... }
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ResolvedTenant => {
    const req = ctx.switchToHttp().getRequest<Request & { tenant?: ResolvedTenant }>()
    if (!req.tenant) {
      throw new Error('CurrentTenant called outside TenantMiddleware scope')
    }
    return req.tenant
  },
)

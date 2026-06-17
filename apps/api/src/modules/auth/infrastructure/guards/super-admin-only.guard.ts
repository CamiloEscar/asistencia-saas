import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { ForbiddenException, Injectable } from '@nestjs/common'

/**
 * SuperAdminOnlyGuard — use this on routes that need cross-tenant
 * access (e.g., `/api/institutions`). Reads `req.user.role` (populated
 * by JwtAuthGuard) and rejects anything other than SUPER_ADMIN.
 *
 * For controllers using this guard, inject `SUPER_ADMIN_PRISMA` instead
 * of the tenant-aware `PrismaService` — that client bypasses the
 * tenant-filter Prisma extension (but RLS is still active at the DB).
 */
@Injectable()
export class SuperAdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { role?: string } }>()
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException({ message: 'Super admin only' })
    }
    return true
  }
}

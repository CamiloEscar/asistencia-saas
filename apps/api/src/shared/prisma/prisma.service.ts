import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { getTenantContext } from '../tenant/tenant.context'
import { tenantAwareExtension } from './tenant-aware.extension'

/**
 * DI token for the unfiltered Prisma client used ONLY by the super-admin
 * code path (guarded by `SuperAdminOnlyGuard`). The app_admin DB role holds
 * BYPASSRLS, so RLS is a no-op for this client; the application layer's
 * audit log is the only cross-tenant data-leak safeguard.
 */
export const SUPER_ADMIN_PRISMA = Symbol('SUPER_ADMIN_PRISMA')

/**
 * The extended Prisma client type. Prisma's `$extends` returns a new type
 * with the extensions baked in — we type our service against that.
 */
function _createExtendedPrisma() {
  return new PrismaClient().$extends(tenantAwareExtension)
}
export type ExtendedPrismaClient = ReturnType<typeof _createExtendedPrisma>

/**
 * PrismaService — single Prisma client wired with the `tenantAwareExtension`.
 * The extension reads the AsyncLocalStorage tenant context (set by
 * TenantMiddleware) and forces every query against a tenant-scoped model to
 * include `institutionId` in the WHERE clause.
 *
 * Usage in a controller / use case:
 *   await this.prisma.user.findMany({ where: { ... } });
 *   // → automatically ANDs institutionId = ctx.tenantId into the WHERE.
 *
 * If no tenant context is set, the extension throws — this is intentional:
 * a missing context means the request was not routed through TenantMiddleware,
 * which is a bug. The only exception is cross-tenant endpoints that opt into
 * the `superAdminPrisma` injection.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  private readonly client: ExtendedPrismaClient

  constructor() {
    this.client = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn', 'info'],
    }).$extends(tenantAwareExtension)
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect()
    this.logger.log('Prisma connected')
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect()
  }

  // ─── Prisma client passthrough (so callers can do prisma.$transaction etc.) ──
  get $connect(): ExtendedPrismaClient['$connect'] {
    return this.client.$connect.bind(this.client)
  }
  get $disconnect(): ExtendedPrismaClient['$disconnect'] {
    return this.client.$disconnect.bind(this.client)
  }
  get $transaction(): ExtendedPrismaClient['$transaction'] {
    return this.client.$transaction.bind(this.client)
  }
  get $queryRaw(): ExtendedPrismaClient['$queryRaw'] {
    return this.client.$queryRaw.bind(this.client)
  }
  get $executeRaw(): ExtendedPrismaClient['$executeRaw'] {
    return this.client.$executeRaw.bind(this.client)
  }
  get $on(): ExtendedPrismaClient['$on'] {
    return this.client.$on.bind(this.client)
  }
  get $use(): ExtendedPrismaClient['$use'] {
    return this.client.$use.bind(this.client)
  }

  // ─── Model delegates ────────────────────────────────────────────────────
  get institution(): ExtendedPrismaClient['institution'] {
    return this.client.institution
  }
  get user(): ExtendedPrismaClient['user'] {
    return this.client.user
  }
  get subject(): ExtendedPrismaClient['subject'] {
    return this.client.subject
  }
  get course(): ExtendedPrismaClient['course'] {
    return this.client.course
  }
  get courseTeacher(): ExtendedPrismaClient['courseTeacher'] {
    return this.client.courseTeacher
  }
  get enrollment(): ExtendedPrismaClient['enrollment'] {
    return this.client.enrollment
  }
  get classSession(): ExtendedPrismaClient['classSession'] {
    return this.client.classSession
  }
  get attendanceRecord(): ExtendedPrismaClient['attendanceRecord'] {
    return this.client.attendanceRecord
  }
  get refreshToken(): ExtendedPrismaClient['refreshToken'] {
    return this.client.refreshToken
  }
  get auditLog(): ExtendedPrismaClient['auditLog'] {
    return this.client.auditLog
  }

  /**
   * Wrap a unit of work in a transaction that sets the
   * `app.current_institution_id` GUC for RLS. Use this when the controller
   * does a multi-step write and you need RLS active for every statement.
   *
   * Single-call reads do NOT need this — the extension's WHERE injection
   * already filters by tenant. Use `forTenant()` for explicit transactional
   * semantics: bulk imports, multi-step writes, anything spanning >1 model.
   */
  async forTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (tx: Prisma.TransactionClient) => {
      // tx is a TransactionClient; SET LOCAL works on the underlying session.
      await tx.$executeRawUnsafe(`SET LOCAL app.current_institution_id = '${tenantId}'`)
      return fn(tx)
    })
  }

  /** Read the current tenant from AsyncLocalStorage. */
  getCurrentTenant(): { tenantId: string; userId?: string; role?: string } | undefined {
    return getTenantContext()
  }
}

/**
 * Provider for the super-admin Prisma client. Same schema/connection as
 * PrismaService but WITHOUT the tenant-aware extension. The DB user must
 * have BYPASSRLS (see migration `app_admin` role). Use ONLY behind
 * `SuperAdminOnlyGuard`.
 */
export function superAdminPrismaProvider() {
  return {
    provide: SUPER_ADMIN_PRISMA,
    useFactory: () => {
      return new PrismaClient({
        log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
      })
    },
  }
}

export { tenantAwareExtension }
export { Prisma }

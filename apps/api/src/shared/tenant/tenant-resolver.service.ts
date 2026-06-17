import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { PrismaClient } from '@prisma/client'
import { SUPER_ADMIN_PRISMA } from '../prisma/prisma.service'
import type { RedisService } from '../redis/redis.service'

const CACHE_TTL_SECONDS = 60
const CACHE_PREFIX = 'tenant:subdomain:'

export interface ResolvedTenant {
  id: string
  subdomain: string
  status: 'ACTIVE' | 'INACTIVE'
  timezone: string
}

/**
 * Resolves a subdomain to an institution. Caches results in Redis for 60s
 * (matches spec REQ-TENANT-002). Cache is invalidated by the institution
 * update/deactivate/reactivate use cases.
 *
 * Uses `SUPER_ADMIN_PRISMA` (no tenant filter extension) because at
 * middleware time we don't have a tenant yet — the WHOLE POINT of this
 * service is to figure out who the tenant is. The query is by `subdomain`
 * UNIQUE so there's no cross-tenant data leak.
 */
@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name)

  constructor(
    @Inject(SUPER_ADMIN_PRISMA) private readonly prisma: PrismaClient,
    private readonly redis: RedisService,
  ) {}

  async resolveBySubdomain(subdomain: string): Promise<ResolvedTenant> {
    const normalized = subdomain.toLowerCase()
    const cacheKey = CACHE_PREFIX + normalized

    // 1. Cache hit
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached) as ResolvedTenant
      } catch (err) {
        this.logger.warn(
          `Bad cache entry for ${subdomain}, falling through to DB: ${(err as Error).message}`,
        )
        await this.redis.del(cacheKey)
      }
    }

    // 2. DB lookup.
    const institution = await this.prisma.institution.findUnique({
      where: { subdomain: normalized },
      select: { id: true, subdomain: true, status: true, timezone: true },
    })

    if (!institution) {
      throw new NotFoundException({
        message: 'Institution not found',
        error: 'Not Found',
      })
    }

    const resolved: ResolvedTenant = {
      id: institution.id,
      subdomain: institution.subdomain,
      status: institution.status as 'ACTIVE' | 'INACTIVE',
      timezone: institution.timezone,
    }

    // 3. Cache only ACTIVE. INACTIVE returns 403 fresh on each call.
    if (resolved.status === 'ACTIVE') {
      await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(resolved))
    }

    return resolved
  }

  /** Called by institution update/deactivate/reactivate to bust the cache. */
  async invalidate(subdomain: string): Promise<void> {
    await this.redis.del(CACHE_PREFIX + subdomain.toLowerCase())
  }
}

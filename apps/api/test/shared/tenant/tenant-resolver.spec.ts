// Unit test for TenantResolverService cache invalidation (task 4.3).
//
// Validates the 3 cache states:
//   1. Cache hit — DB is NOT queried, cached value is returned.
//   2. Cache miss — DB is queried, result is cached.
//   3. Invalidate — next call re-fetches from DB.

import { Test } from '@nestjs/testing'
import { TenantResolverService } from '../../../src/shared/tenant/tenant-resolver.service'
import { RedisService } from '../../../src/shared/redis/redis.service'
import { SUPER_ADMIN_PRISMA } from '../../../src/shared/prisma/prisma.service'
import type { PrismaClient } from '@prisma/client'

describe('TenantResolverService cache (task 4.3)', () => {
  let service: TenantResolverService
  let redis: { get: jest.Mock; setex: jest.Mock; del: jest.Mock }
  let prisma: { institution: { findUnique: jest.Mock } }

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    }
    prisma = {
      institution: {
        findUnique: jest.fn(),
      },
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        TenantResolverService,
        { provide: RedisService, useValue: redis },
        { provide: SUPER_ADMIN_PRISMA, useValue: prisma as unknown as PrismaClient },
      ],
    }).compile()
    service = moduleRef.get(TenantResolverService)
  })

  it('returns the cached value on hit (no DB call)', async () => {
    const cached = { id: 'i-1', subdomain: 'a', status: 'ACTIVE', timezone: 'UTC' }
    redis.get.mockResolvedValueOnce(JSON.stringify(cached))

    const result = await service.resolveBySubdomain('a')

    expect(result).toEqual(cached)
    expect(prisma.institution.findUnique).not.toHaveBeenCalled()
  })

  it('queries DB on miss, caches the result, returns it', async () => {
    redis.get.mockResolvedValueOnce(null)
    prisma.institution.findUnique.mockResolvedValueOnce({
      id: 'i-1',
      subdomain: 'a',
      status: 'ACTIVE',
      timezone: 'UTC',
    })

    const result = await service.resolveBySubdomain('a')

    expect(result).toEqual({ id: 'i-1', subdomain: 'a', status: 'ACTIVE', timezone: 'UTC' })
    expect(prisma.institution.findUnique).toHaveBeenCalledWith({
      where: { subdomain: 'a' },
      select: { id: true, subdomain: true, status: true, timezone: true },
    })
    expect(redis.setex).toHaveBeenCalledWith('tenant:subdomain:a', 60, JSON.stringify(result))
  })

  it('does NOT cache INACTIVE institutions', async () => {
    redis.get.mockResolvedValueOnce(null)
    prisma.institution.findUnique.mockResolvedValueOnce({
      id: 'i-2',
      subdomain: 'b',
      status: 'INACTIVE',
      timezone: 'UTC',
    })

    await expect(service.resolveBySubdomain('b')).rejects.toThrow(/inactive/i)
    expect(redis.setex).not.toHaveBeenCalled()
  })

  it('throws 404 when DB returns nothing', async () => {
    redis.get.mockResolvedValueOnce(null)
    prisma.institution.findUnique.mockResolvedValueOnce(null)

    await expect(service.resolveBySubdomain('missing')).rejects.toThrow(/not found/i)
  })

  it('invalidate() deletes the cache key', async () => {
    await service.invalidate('Test-A')
    expect(redis.del).toHaveBeenCalledWith('tenant:subdomain:test-a')
  })

  it('on cache hit with malformed JSON, falls through to DB and overwrites cache', async () => {
    redis.get.mockResolvedValueOnce('{ this is not JSON')
    redis.del.mockResolvedValueOnce(1)
    prisma.institution.findUnique.mockResolvedValueOnce({
      id: 'i-3',
      subdomain: 'c',
      status: 'ACTIVE',
      timezone: 'UTC',
    })

    const result = await service.resolveBySubdomain('c')

    expect(result.id).toBe('i-3')
    expect(redis.del).toHaveBeenCalledWith('tenant:subdomain:c')
    expect(redis.setex).toHaveBeenCalled()
  })
})

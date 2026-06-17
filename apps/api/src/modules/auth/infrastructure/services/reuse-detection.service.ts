import { Inject, Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type Redis from 'ioredis'

/**
 * Redis-based refresh-token reuse detection (per design §3.3).
 *
 * The hot path uses Redis HASHes keyed `refresh:{userId}:{jti}` with
 * fields `{ status: 'active'|'used', familyId, issuedAt }`. On every
 * `/auth/refresh` we call `recordUse()` which atomically:
 *
 *   1. Checks the family-revoked key `refresh:{userId}:family:{familyId}:revoked`
 *      → if set, returns 'FAMILY_REVOKED' (entire family nuked, no new tokens).
 *   2. Checks the old jti key → if missing, 'NOT_FOUND'.
 *   3. Reads the old status → if not 'active', this is REUSE: sets the
 *      family-revoked key (7d TTL) and returns 'REUSE_DETECTED'.
 *   4. Otherwise flips the old status to 'used' (preserving the row for
 *      audit), writes the new active key, returns 'OK'.
 *
 * The DB is the durable mirror (PrismaRefreshTokenRepository). If Redis
 * is down, the use case falls back to DB-only checks (slower but correct).
 *
 * Keys:
 *   - `refresh:{userId}:{jti}` (HASH) — `{ status, familyId, issuedAt }`
 *   - `refresh:{userId}:family:{familyId}:revoked` (string, value '1')
 */
export type ReuseResult = 'OK' | 'REUSE_DETECTED' | 'FAMILY_REVOKED' | 'NOT_FOUND'

export const REFRESH_REDIS_CLIENT = Symbol('REFRESH_REDIS_CLIENT')

@Injectable()
export class ReuseDetectionService {
  private readonly logger = new Logger(ReuseDetectionService.name)
  private readonly familyRevokedTtlSeconds = 7 * 24 * 60 * 60 // 7 days

  constructor(@Inject(REFRESH_REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Atomically: validate the old jti, flip it to 'used' on success, set
   * the new jti as 'active', and detect reuse. Single round-trip via Lua.
   */
  async recordUse(args: {
    userId: string
    oldJti: string
    newJti: string
    familyId: string
    expirySeconds: number
  }): Promise<ReuseResult> {
    const oldKey = this.key(args.userId, args.oldJti)
    const familyRevokedKey = this.familyKey(args.userId, args.familyId)
    const newKey = this.key(args.userId, args.newJti)

    // The Lua script encodes the entire state machine. Single round-trip
    // is critical for atomicity: two concurrent refreshes of the same
    // token MUST resolve deterministically (REQ-AUTH-004-02).
    //
    // Returns: 'OK' | 'REUSE_DETECTED' | 'FAMILY_REVOKED' | 'NOT_FOUND'
    const lua = `
local familyRevokedKey = KEYS[1]
local oldKey = KEYS[2]
local newKey = KEYS[3]

local newJti = ARGV[1]
local familyId = ARGV[2]
local issuedAt = ARGV[3]
local ttl = tonumber(ARGV[4])

if redis.call('EXISTS', familyRevokedKey) == 1 then
  return 'FAMILY_REVOKED'
end

if redis.call('EXISTS', oldKey) == 0 then
  return 'NOT_FOUND'
end

local status = redis.call('HGET', oldKey, 'status')
if status ~= 'active' then
  redis.call('SET', familyRevokedKey, '1', 'EX', ${this.familyRevokedTtlSeconds})
  return 'REUSE_DETECTED'
end

redis.call('HSET', oldKey, 'status', 'used')
redis.call('EXPIRE', oldKey, ${this.familyRevokedTtlSeconds})
redis.call('HSET', newKey, 'status', 'active', 'familyId', familyId, 'issuedAt', issuedAt)
redis.call('EXPIRE', newKey, ttl)
return 'OK'
`

    const result = (await this.redis.eval(
      lua,
      3,
      familyRevokedKey,
      oldKey,
      newKey,
      args.newJti,
      args.familyId,
      String(Math.floor(Date.now() / 1000)),
      String(args.expirySeconds),
    )) as ReuseResult

    return result
  }

  /**
   * Revoke an entire family (called on logout, or as a follow-up to a
   * 'REUSE_DETECTED' result from the DB mirror).
   */
  async revokeFamily(userId: string, familyId: string): Promise<void> {
    await this.redis.set(this.familyKey(userId, familyId), '1', 'EX', this.familyRevokedTtlSeconds)
  }

  /**
   * Initialize a new active refresh token (called from LoginUseCase).
   */
  async issueActive(args: {
    userId: string
    jti: string
    familyId: string
    expirySeconds: number
  }): Promise<void> {
    await this.redis.hset(this.key(args.userId, args.jti), {
      status: 'active',
      familyId: args.familyId,
      issuedAt: String(Math.floor(Date.now() / 1000)),
    })
    await this.redis.expire(this.key(args.userId, args.jti), args.expirySeconds)
  }

  /** Check whether a family has been revoked (for paranoia / defense in depth). */
  async isFamilyRevoked(userId: string, familyId: string): Promise<boolean> {
    return (await this.redis.exists(this.familyKey(userId, familyId))) === 1
  }

  /** Issue a fresh family id (uuid). */
  newFamilyId(): string {
    return randomUUID()
  }

  private key(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`
  }

  private familyKey(userId: string, familyId: string): string {
    return `refresh:${userId}:family:${familyId}:revoked`
  }
}

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
import type Redis from 'ioredis'

/**
 * Single Redis connection wrapper. Loaded as a global provider.
 *
 * NOTE: we use the default DB (0) for cache + throttler; refresh tokens
 * live in DB 1, activation tokens in DB 2, BullMQ in DB 3. Each DB has
 * its own connection; this service uses DB 0 only. Additional connections
 * are opened by feature-specific services (auth, bulk-import).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client!: Redis

  constructor(@Inject('REDIS_CLIENT') client: Redis) {
    this.client = client
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.ping()
      this.logger.log('Redis connected')
    } catch (err) {
      this.logger.warn(`Redis ping failed at boot: ${(err as Error).message}`)
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit()
  }

  // ─── String ops ────────────────────────────────────────────────────────
  get(key: string): Promise<string | null> {
    return this.client.get(key)
  }
  set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) return this.client.set(key, value, 'EX', ttl) as Promise<'OK'>
    return this.client.set(key, value) as Promise<'OK'>
  }
  setex(key: string, ttl: number, value: string): Promise<'OK'> {
    return this.client.setex(key, ttl, value) as Promise<'OK'>
  }
  del(...keys: string[]): Promise<number> {
    return this.client.del(...keys)
  }
  exists(...keys: string[]): Promise<number> {
    return this.client.exists(...keys)
  }
  expire(key: string, ttl: number): Promise<number> {
    return this.client.expire(key, ttl)
  }
  ttl(key: string): Promise<number> {
    return this.client.ttl(key)
  }

  // ─── Hash ops ─────────────────────────────────────────────────────────
  hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field)
  }
  hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value)
  }
  hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key)
  }

  // ─── Eval (Lua scripts) ───────────────────────────────────────────────
  eval(script: string, numKeys: number, args: Array<string | number>): Promise<unknown> {
    return this.client.eval(script, numKeys, ...args)
  }

  // ─── Scan (used for family revocation) ─────────────────────────────────
  async scanMatch(pattern: string): Promise<string[]> {
    const out: string[] = []
    let cursor = '0'
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
      cursor = next
      out.push(...keys)
    } while (cursor !== '0')
    return out
  }

  ping(): Promise<string> {
    return this.client.ping()
  }
}

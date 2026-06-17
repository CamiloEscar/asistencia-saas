import { Inject, Injectable, Logger } from '@nestjs/common'
import * as argon2 from 'argon2'

/**
 * Argon2id parameters. Hardcoded defaults from env (set in env.schema.ts):
 *   memoryCost: 65536 (64 MiB) — per spec REQ-AUTH-011 ("memory ≥ 64MB").
 *   timeCost:   3 iterations.
 *   parallelism: 4 lanes.
 *
 * These are the OWASP 2024 minimums for Argon2id. They're read from env on
 * construction so ops can tune without code changes (and so tests can use
 * lower parameters to keep CI fast).
 */
export interface Argon2Params {
  memoryCost: number
  timeCost: number
  parallelism: number
}

export const ARGON2_OPTIONS = 'ARGON2_OPTIONS'

/**
 * Password hashing using Argon2id. The single chokepoint for `hash` /
 * `verify` across the application — use cases, seeds, scripts all call this.
 *
 * Plaintext passwords NEVER leave this service. The HTTP layer, audit
 * interceptor, and Pino redactor all cooperate to make sure passwords
 * don't reach logs (see `logger.module.ts` redact list).
 */
@Injectable()
export class PasswordHasherService {
  private readonly logger = new Logger(PasswordHasherService.name)

  constructor(@Inject(ARGON2_OPTIONS) private readonly params: Argon2Params) {}

  /**
   * Hash a plaintext password. Returns the encoded string in PHC format:
   *   `$argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>`
   * The salt is generated internally by argon2 (16 bytes by default).
   */
  async hash(plain: string): Promise<string> {
    if (!plain) throw new Error('Password is required')
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: this.params.memoryCost,
      timeCost: this.params.timeCost,
      parallelism: this.params.parallelism,
    })
  }

  /**
   * Verify a plaintext password against a stored PHC-format hash. Returns
   * false on mismatch OR on a malformed hash (no exception — the caller
   * treats both cases as "invalid credentials" to prevent enumeration).
   */
  async verify(plain: string, hash: string): Promise<boolean> {
    if (!plain || !hash) return false
    try {
      return await argon2.verify(hash, plain)
    } catch (err) {
      this.logger.warn(`argon2.verify failed: ${(err as Error).message}`)
      return false
    }
  }
}

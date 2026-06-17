import { Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { sign, verify, type Algorithm, type SignOptions } from 'jsonwebtoken'
import type { JwtKeysService } from './jwt-keys.service'

/**
 * Common claims every token we issue carries.
 *   - `sub`: user id
 *   - `role`: user role
 *   - `institutionId`: tenant id (null for SUPER_ADMIN per spec)
 *   - `jti`: unique token id (128-bit random for refresh, uuid for activation)
 *   - `iat`, `exp`: standard JWT timestamps
 *   - `purpose`: optional discriminator (`'refresh'`, `'set_password'`)
 */
export interface TokenClaims {
  sub: string
  role: string
  institutionId: string | null
  jti: string
  iat?: number
  exp?: number
  purpose?: 'refresh' | 'set_password'
  email?: string
}

/**
 * TTLs (per spec REQ-AUTH-002 / REQ-AUTH-007). Parsed by NestJS as strings
 * from env (`JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `JWT_ACTIVATION_TTL`) —
 * `jsonwebtoken` accepts these as the `expiresIn` option.
 */
export interface JwtTtls {
  access: string
  refresh: string
  activation: string
}

/**
 * JwtService — wraps `jsonwebtoken` for sign + verify with RS256.
 *
 * Uses the keys loaded by `JwtKeysService`. Refresh tokens carry a
 * `purpose: 'refresh'` claim so they can never be confused with access
 * tokens by a future middleware.
 *
 * JTI generation:
 *   - Access tokens: 128-bit random hex (defense in depth; not used by
 *     any flow but allows future revocation lists).
 *   - Refresh tokens: 128-bit random hex (stored as the Redis key suffix
 *     and the DB `jti` column for reuse detection).
 *   - Activation tokens: 128-bit random hex.
 */
@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name)
  private readonly algorithm: Algorithm = 'RS256'

  constructor(
    private readonly keys: JwtKeysService,
    private readonly ttls: JwtTtls,
  ) {}

  /**
   * Sign an access token. No `purpose` claim (access tokens are the default).
   */
  signAccessToken(claims: Omit<TokenClaims, 'purpose' | 'jti' | 'iat' | 'exp'>): {
    token: string
    jti: string
    expiresAt: Date
  } {
    const jti = randomBytes(32).toString('hex') // 256-bit
    const options: SignOptions = {
      algorithm: this.algorithm,
      expiresIn: this.ttls.access as SignOptions['expiresIn'],
      keyid: this.keys.getKeyId(),
    }
    const token = sign({ ...claims, jti }, this.keys.getPrivateKey(), options)
    const expiresAt = this.computeExpiry(this.ttls.access)
    return { token, jti, expiresAt }
  }

  /**
   * Sign a refresh token. Carries `purpose: 'refresh'`.
   */
  signRefreshToken(claims: {
    sub: string
    role: string
    institutionId: string | null
    familyId: string
  }): { token: string; jti: string; expiresAt: Date } {
    const jti = randomBytes(32).toString('hex')
    const options: SignOptions = {
      algorithm: this.algorithm,
      expiresIn: this.ttls.refresh as SignOptions['expiresIn'],
      keyid: this.keys.getKeyId(),
    }
    const token = sign({ ...claims, jti, purpose: 'refresh' }, this.keys.getPrivateKey(), options)
    const expiresAt = this.computeExpiry(this.ttls.refresh)
    return { token, jti, expiresAt }
  }

  /**
   * Sign an activation (set-password) token. Carries `purpose: 'set_password'`
   * and the user's email (used for audit trail in the Redis record).
   */
  signActivationToken(claims: { sub: string; email: string }): {
    token: string
    jti: string
    expiresAt: Date
  } {
    const jti = randomBytes(32).toString('hex')
    const options: SignOptions = {
      algorithm: this.algorithm,
      expiresIn: this.ttls.activation as SignOptions['expiresIn'],
      keyid: this.keys.getKeyId(),
    }
    const token = sign(
      { ...claims, jti, purpose: 'set_password', institutionId: null, role: 'ACTIVATION' },
      this.keys.getPrivateKey(),
      options,
    )
    const expiresAt = this.computeExpiry(this.ttls.activation)
    return { token, jti, expiresAt }
  }

  /**
   * Verify an access token. Throws on any error (expired, bad signature,
   * wrong audience, etc.) — callers map to 401.
   */
  verifyAccessToken(token: string): TokenClaims {
    return this.verify(token)
  }

  /**
   * Verify a refresh token. Throws on any error. The `purpose` claim MUST
   * be `'refresh'` — otherwise we throw.
   */
  verifyRefreshToken(token: string): TokenClaims {
    const claims = this.verify(token)
    if (claims.purpose !== 'refresh') {
      throw new Error('Not a refresh token')
    }
    return claims
  }

  /**
   * Verify an activation token. Throws on any error. The `purpose` claim
   * MUST be `'set_password'`.
   */
  verifyActivationToken(token: string): TokenClaims {
    const claims = this.verify(token)
    if (claims.purpose !== 'set_password') {
      throw new Error('Not an activation token')
    }
    return claims
  }

  // ─── internals ─────────────────────────────────────────────────────────

  private verify(token: string): TokenClaims {
    const payload = verify(token, this.keys.getPublicKey(), {
      algorithms: [this.algorithm],
    }) as TokenClaims
    return payload
  }

  /**
   * Convert a TTL string like `'15m'`, `'7d'`, `'48h'` to an absolute Date.
   * Supports: ms/s/m/h/d (case-insensitive suffix).
   */
  private computeExpiry(ttl: string): Date {
    const m = /^(\d+)(ms|s|m|h|d)$/i.exec(ttl.trim())
    if (!m) throw new Error(`Invalid TTL format: ${ttl}`)
    const value = Number(m[1])
    const unit = (m[2] ?? 's').toLowerCase()
    const ms =
      unit === 'ms'
        ? value
        : unit === 's'
          ? value * 1000
          : unit === 'm'
            ? value * 60 * 1000
            : unit === 'h'
              ? value * 60 * 60 * 1000
              : value * 24 * 60 * 60 * 1000
    return new Date(Date.now() + ms)
  }
}

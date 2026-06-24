import { Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { sign, verify, type Algorithm, type SignOptions } from 'jsonwebtoken'
import  { JwtKeysService } from './jwt-keys.service'

export interface TokenClaims {
  sub: string
  role: string
  jti: string
  iat?: number
  exp?: number
  purpose?: 'refresh' | 'set_password'
  email?: string
}

export interface JwtTtls {
  access: string
  refresh: string
  activation: string
}

@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name)
  private readonly algorithm: Algorithm = 'RS256'

  constructor(
    private readonly keys: JwtKeysService,
    private readonly ttls: JwtTtls,
  ) {}

  signAccessToken(claims: Omit<TokenClaims, 'purpose' | 'jti' | 'iat' | 'exp'>): {
    token: string
    jti: string
    expiresAt: Date
  } {
    const jti = randomBytes(32).toString('hex')
    const options: SignOptions = {
      algorithm: this.algorithm,
      expiresIn: this.ttls.access as SignOptions['expiresIn'],
      keyid: this.keys.getKeyId(),
    }
    const token = sign({ ...claims, jti }, this.keys.getPrivateKey(), options)
    return { token, jti, expiresAt: this.computeExpiry(this.ttls.access) }
  }

  signRefreshToken(claims: { sub: string; role: string; familyId: string }): {
    token: string
    jti: string
    expiresAt: Date
  } {
    const jti = randomBytes(32).toString('hex')
    const options: SignOptions = {
      algorithm: this.algorithm,
      expiresIn: this.ttls.refresh as SignOptions['expiresIn'],
      keyid: this.keys.getKeyId(),
    }
    const token = sign({ ...claims, jti, purpose: 'refresh' }, this.keys.getPrivateKey(), options)
    return { token, jti, expiresAt: this.computeExpiry(this.ttls.refresh) }
  }

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
      { ...claims, jti, purpose: 'set_password', role: 'ACTIVATION' },
      this.keys.getPrivateKey(),
      options,
    )
    return { token, jti, expiresAt: this.computeExpiry(this.ttls.activation) }
  }

  verifyAccessToken(token: string): TokenClaims {
    return this.verify(token)
  }

  verifyRefreshToken(token: string): TokenClaims {
    const claims = this.verify(token)
    if (claims.purpose !== 'refresh') throw new Error('Not a refresh token')
    return claims
  }

  verifyActivationToken(token: string): TokenClaims {
    const claims = this.verify(token)
    if (claims.purpose !== 'set_password') throw new Error('Not an activation token')
    return claims
  }

  private verify(token: string): TokenClaims {
    return verify(token, this.keys.getPublicKey(), {
      algorithms: [this.algorithm],
    }) as TokenClaims
  }

  private computeExpiry(ttl: string): Date {
    const m = /^(\d+)(ms|s|m|h|d)$/i.exec(ttl.trim())
    if (!m) throw new Error(`Invalid TTL format: ${ttl}`)
    const value = Number(m[1])
    const unit = (m[2] ?? 's').toLowerCase()
    const ms =
      unit === 'ms' ? value
      : unit === 's' ? value * 1000
      : unit === 'm' ? value * 60 * 1000
      : unit === 'h' ? value * 60 * 60 * 1000
      : value * 24 * 60 * 60 * 1000
    return new Date(Date.now() + ms)
  }
}

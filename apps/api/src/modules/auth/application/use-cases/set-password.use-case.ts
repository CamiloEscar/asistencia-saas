import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import type Redis from 'ioredis'
import type { JwtService } from '../../../../shared/crypto/jwt.service'
import type { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface'
import type { UserRepository } from '../../domain/repositories/user.repository.interface'
import type { LoginUseCase } from './login.use-case'
import type { SetPasswordResponse, SetPasswordIssueResponse } from '../dtos/set-password.dto'

/**
 * Set-password signed-link flow (per spec REQ-AUTH-007).
 *
 * Two-step:
 *   - `issue(userId)`: admin calls this with a user id. We issue a signed
 *     JWT with `purpose: 'set_password'`, 48h TTL, and a random jti. The
 *     jti is stored in Redis under `activation:{jti}` with the user's id
 *     and email, and TTL 48h. We return the token + the full URL (since
 *     there's no SMTP in MVP — see spec REQ-AUTH-008).
 *   - `consume(token, newPassword)`: end user calls this with the token
 *     and their new password. We verify the JWT, check Redis to confirm
 *     the jti is still active (not yet consumed), hash the new password
 *     with Argon2id, update the user, mark the jti as used in Redis,
 *     and auto-login (return access + refresh tokens).
 *
 * Reuse is blocked at the Redis layer (single-use). If the same token
 * is presented twice, the second call sees `status: 'used'` and throws
 * 401 "Token already used".
 */

const ACTIVATION_PREFIX = 'activation:'
const ACTIVATION_TTL_SECONDS = 48 * 60 * 60

@Injectable()
export class SetPasswordUseCase {
  private readonly logger = new Logger(SetPasswordUseCase.name)

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwt: JwtService,
    private readonly loginUseCase: LoginUseCase,
    @Inject('ACTIVATION_REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async issue(userId: string): Promise<SetPasswordIssueResponse> {
    const user = await this.users.findByIdForAuth(userId)
    if (!user) {
      throw new UnauthorizedException({ message: 'User not found' })
    }

    const { token, jti, expiresAt } = this.jwt.signActivationToken({
      sub: user.id,
      email: user.email,
    })

    await this.redis.set(
      `${ACTIVATION_PREFIX}${jti}`,
      JSON.stringify({ userId: user.id, email: user.email, status: 'active' }),
      'EX',
      ACTIVATION_TTL_SECONDS,
    )

    const resetUrl = `${process.env.WEB_URL ?? 'http://localhost:5173'}/set-password?token=${encodeURIComponent(token)}`

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      resetUrl,
    }
  }

  async consume(token: string, newPassword: string): Promise<SetPasswordResponse> {
    // 1. Verify JWT signature + purpose.
    let claims
    try {
      claims = this.jwt.verifyActivationToken(token)
    } catch {
      throw new UnauthorizedException({
        message: 'Token invalid or expired',
      })
    }

    if (!claims.jti) {
      throw new UnauthorizedException({ message: 'Token invalid' })
    }

    // 2. Check Redis: status must be 'active'.
    const raw = await this.redis.get(`${ACTIVATION_PREFIX}${claims.jti}`)
    if (!raw) {
      throw new UnauthorizedException({ message: 'Token expired or already used' })
    }
    const record = JSON.parse(raw) as { status: string; userId: string }
    if (record.status !== 'active') {
      throw new UnauthorizedException({ message: 'Token already used' })
    }

    // 3. Atomic flip: SET with NX to a "used" marker. If it fails, someone
    // else consumed it between our GET and SET — reject.
    const consumed = await this.redis.set(
      `${ACTIVATION_PREFIX}${claims.jti}`,
      JSON.stringify({ ...record, status: 'used', consumedAt: new Date().toISOString() }),
      'EX',
      ACTIVATION_TTL_SECONDS,
      'XX', // only update if key exists
    )
    if (consumed !== 'OK') {
      throw new UnauthorizedException({ message: 'Token already used' })
    }

    // 4. Hash new password + update user.
    const hash = await this.passwordHasher.hash(newPassword)
    const updated = await this.users.updatePasswordHash(record.userId, hash)

    // 5. Establish tenant context for the auto-login (so the Prisma
    // extension WHERE-injection doesn't blow up). The user's institution
    // is non-null for everyone except SUPER_ADMIN, but activation tokens
    // are only for non-super users (admins issue them for teachers/
    // students in their tenant). We delegate to LoginUseCase.issueTokenPair
    // which handles both cases (it signs the JWT with institutionId from
    // the user record and writes the refresh state — Prisma queries in
    // that path use the SUPER_ADMIN client where needed).
    const tokenPair = await this.loginUseCase.issueTokenPair({
      user: updated,
    })
    return {
      user: updated.toPublicJson(),
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
    }
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { SUPER_ADMIN_PRISMA } from '../../../../shared/prisma/prisma.service'
import type {
  CreateRefreshTokenInput,
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository.interface'

/**
 * Prisma implementation of `RefreshTokenRepository`.
 *
 * Uses `SUPER_ADMIN_PRISMA` so the table is the canonical durable store
 * for refresh token state (we don't want a missing tenant context to
 * make a refresh request fail). The `userId` FK already enforces the
 * link; defense-in-depth RLS is active for the DB role used here (the
 * migration grants the regular app_user `BYPASSRLS=false` for refresh
 * tokens, so the policy still applies — but the refresh flow only
 * touches its own rows by `userId`).
 *
 * Token hashing: SHA-256 of the raw JWT. argon2 would be overkill (we
 * don't need to be slow — the token is high-entropy), but a plain
 * equality check would expose raw tokens to anyone with DB read
 * (logs, pg_dump). SHA-256 is fast and irreversible.
 */
@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(@Inject(SUPER_ADMIN_PRISMA) private readonly prisma: PrismaClient) {}

  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord> {
    const row = await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        jti: input.jti,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
        tokenHash: input.tokenHash,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
      },
    })
    return this.toRecord(row)
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findFirst({ where: { tokenHash } })
    return row ? this.toRecord(row) : null
  }

  async findByJti(jti: string): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { jti } })
    return row ? this.toRecord(row) : null
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { status: 'used' },
    })
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { status: 'revoked', revokedAt: new Date() },
    })
  }

  async markFamilyRevoked(familyId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { familyId, status: { not: 'revoked' } },
      data: { status: 'revoked', revokedAt: new Date() },
    })
    return result.count
  }

  async findActiveFamiliesByUserId(userId: string): Promise<string[]> {
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, status: 'active' },
      select: { familyId: true },
      distinct: ['familyId'],
    })
    return rows.map((r: { familyId: string }) => r.familyId)
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex')
  }

  private toRecord(row: {
    id: string
    userId: string
    jti: string
    familyId: string
    status: string
    expiresAt: Date
    revokedAt: Date | null
    tokenHash: string
  }): RefreshTokenRecord {
    return {
      id: row.id,
      userId: row.userId,
      jti: row.jti,
      familyId: row.familyId,
      status: row.status as RefreshTokenRecord['status'],
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      tokenHash: row.tokenHash,
    }
  }
}

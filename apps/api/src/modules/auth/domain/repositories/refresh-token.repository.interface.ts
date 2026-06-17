import type { User } from '../entities/user.entity'

/**
 * Domain interface for refresh token persistence. The Redis store is the
 * hot path (every refresh hits Redis first); the DB is the durable mirror
 * for the audit trail + post-incident forensics (REQ-AUTH-004, design §3.3).
 *
 * Refresh tokens are stored as HASHES of the JWT — we never persist the
 * raw token (REQ-AUTH-006, design §3.5).
 */
export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY')

export interface CreateRefreshTokenInput {
  userId: string
  jti: string
  tokenHash: string
  familyId: string
  expiresAt: Date
  userAgent?: string | null
  ipAddress?: string | null
}

export interface RefreshTokenRecord {
  id: string
  userId: string
  jti: string
  familyId: string
  status: 'active' | 'used' | 'revoked'
  expiresAt: Date
  revokedAt: Date | null
  tokenHash: string
}

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord>
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>
  findByJti(jti: string): Promise<RefreshTokenRecord | null>
  markUsed(id: string): Promise<void>
  revokeById(id: string): Promise<void>
  /** Mark every record in a family as revoked (the reuse-detection response). */
  markFamilyRevoked(familyId: string): Promise<number>
  /** List the active families for a user (for logout-without-token). */
  findActiveFamiliesByUserId(userId: string): Promise<string[]>
  /** Map a raw token into its hash via the same algorithm the writer used. */
  hashToken(rawToken: string): string
  _typecheck?: { user: User }
}

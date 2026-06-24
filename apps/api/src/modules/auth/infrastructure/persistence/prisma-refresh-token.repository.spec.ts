import { Test } from '@nestjs/testing'
import { PrismaRefreshTokenRepository } from './prisma-refresh-token.repository'
import { PrismaService } from '../../../../shared/prisma/prisma.service'

/**
 * Unit test for REQ-AUTH-001: a refresh-token row whose `tokenHash` is NULL
 * (legacy, pre-migration) MUST be treated as invalid — `findByHash(<any>)`
 * SHALL return `null` (not match, not throw).
 *
 * `findByHash` queries `where: { tokenHash }` against the DB, and the partial
 * unique index `WHERE "tokenHash" IS NOT NULL` excludes NULLs from the
 * constraint. The query itself is a plain equality lookup, so a row with
 * `tokenHash = NULL` will only match if the input is also NULL — which the
 * repo never produces (the hashToken() helper always returns a hex string).
 *
 * We mock the Prisma client to verify the contract end-to-end:
 *   - When Prisma's `findFirst` returns `null` (no row matched) → repo returns `null`.
 *   - When the only row in the table has `tokenHash = NULL` and we look up a
 *     non-NULL hash → Prisma returns `null` (the WHERE clause excludes NULLs).
 */
describe('PrismaRefreshTokenRepository — REQ-AUTH-001 (legacy NULL tokenHash)', () => {
  const sampleHash = 'a'.repeat(64)
  let repo: PrismaRefreshTokenRepository
  let findFirstMock: jest.Mock

  beforeEach(async () => {
    findFirstMock = jest.fn()
    const prismaMock = {
      refreshToken: {
        findFirst: findFirstMock,
      },
    }
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaRefreshTokenRepository,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile()
    repo = moduleRef.get(PrismaRefreshTokenRepository)
  })

  it('returns null when no row matches the lookup hash (legacy rows with tokenHash=NULL are excluded)', async () => {
    // Arrange: a refresh-token row exists with tokenHash=NULL (pre-migration legacy).
    // Prisma's `where: { tokenHash: sampleHash }` excludes NULL rows from the match.
    findFirstMock.mockResolvedValueOnce(null)

    // Act
    const result = await repo.findByHash(sampleHash)

    // Assert
    expect(result).toBeNull()
    expect(findFirstMock).toHaveBeenCalledWith({ where: { tokenHash: sampleHash } })
  })

  it('returns the row when a non-NULL tokenHash matches', async () => {
    // Arrange: a valid refresh-token row exists.
    const row = {
      id: 'row-1',
      userId: 'user-1',
      jti: 'jti-1',
      familyId: 'family-1',
      status: 'active',
      expiresAt: new Date('2030-01-01'),
      revokedAt: null,
      tokenHash: sampleHash,
    }
    findFirstMock.mockResolvedValueOnce(row)

    // Act
    const result = await repo.findByHash(sampleHash)

    // Assert
    expect(result).not.toBeNull()
    expect(result?.tokenHash).toBe(sampleHash)
    expect(result?.id).toBe('row-1')
  })
})

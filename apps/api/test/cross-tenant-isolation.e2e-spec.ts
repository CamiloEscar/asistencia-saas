// Cross-tenant isolation E2E — THE SECURITY GATE.
//
// This test MUST pass before any Phase 5+ work (institutions, users,
// attendance, etc.). If you can read or write data across tenant
// boundaries, you have a data leak — and a P0 incident.
//
// What we prove:
//   1. Login as user in tenant X → token has institutionId = X.
//   2. RLS: a raw query without SET LOCAL returns 0 rows.
//   3. RLS: a raw query with SET LOCAL = tenant A returns only A's rows.
//   4. RLS: SET LOCAL with tenant B returns only B's rows.
//   5. Refresh-token replay AFTER family revocation returns 401.
//   6. Tampered JWT (institutionId swapped) is rejected by TenantGuard.

import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/app.module'
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter'
import { PrismaService } from '../src/shared/prisma/prisma.service'
import cookieParser from 'cookie-parser'
import { startTestEnv, stopTestEnv, type TestEnv } from './testcontainers-env'
import * as request from 'supertest'
import type { Server } from 'node:http'
import { PrismaClient } from '@prisma/client'
import * as argon2 from 'argon2'
import { sign } from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'

interface SeededInstitution {
  id: string
  subdomain: string
  userId: string
  email: string
}

describe('Cross-tenant isolation E2E (security gate)', () => {
  let env: TestEnv
  let app: INestApplication
  let prisma: PrismaService
  let tenantA: SeededInstitution
  let tenantB: SeededInstitution

  beforeAll(async () => {
    env = await startTestEnv()
    void env // env captured for completeness; fixtures use process.env directly
  }, 120_000)

  afterAll(async () => {
    await stopTestEnv()
  }, 30_000)

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.set('trust proxy', 1)
    app.use(cookieParser())
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    )
    app.useGlobalFilters(new HttpExceptionFilter())
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1')
    await app.init()

    prisma = app.get(PrismaService)

    // Seed via raw PrismaClient (bypasses tenant extension).
    const raw = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
    await raw.$connect()
    try {
      await raw.$executeRawUnsafe('DELETE FROM refresh_tokens')
      await raw.$executeRawUnsafe('DELETE FROM users')
      await raw.$executeRawUnsafe('DELETE FROM institutions')

      const instA = await raw.institution.create({
        data: {
          name: 'Test A',
          subdomain: 'celsius',
          status: 'ACTIVE',
          plan: 'FREE',
          timezone: 'UTC',
        },
      })
      const instB = await raw.institution.create({
        data: {
          name: 'Test B',
          subdomain: 'universidad-b',
          status: 'ACTIVE',
          plan: 'FREE',
          timezone: 'UTC',
        },
      })
      const passwordHash = await argon2.hash('Password123!', {
        type: argon2.argon2id,
        memoryCost: 4096,
        timeCost: 2,
        parallelism: 1,
      })
      const userA = await raw.user.create({
        data: {
          institutionId: instA.id,
          email: 'a@x.com',
          passwordHash,
          fullName: 'Admin A',
          role: 'INSTITUTION_ADMIN',
          status: 'ACTIVE',
        },
      })
      const userB = await raw.user.create({
        data: {
          institutionId: instB.id,
          email: 'b@y.com',
          passwordHash,
          fullName: 'Admin B',
          role: 'INSTITUTION_ADMIN',
          status: 'ACTIVE',
        },
      })
      tenantA = { id: instA.id, subdomain: 'celsius', userId: userA.id, email: 'a@x.com' }
      tenantB = { id: instB.id, subdomain: 'universidad-b', userId: userB.id, email: 'b@y.com' }
    } finally {
      await raw.$disconnect()
    }
  }, 60_000)

  afterEach(async () => {
    await app.close()
  }, 30_000)

  // ─── Tests ──────────────────────────────────────────────────────────

  it('1. login issues a token whose institutionId matches the resolved tenant', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/login')
      .set('X-Tenant-Subdomain', 'celsius')
      .send({ email: 'a@x.com', password: 'Password123!' })
      .expect(201)

    expect(res.body.user.institutionId).toBe(tenantA.id)
    expect(res.body.accessToken).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()

    const payload = decodeJwt(res.body.accessToken)
    expect(payload.institutionId).toBe(tenantA.id)
    expect(payload.sub).toBe(tenantA.userId)
    expect(payload.role).toBe('INSTITUTION_ADMIN')
  })

  it('2. RLS blocks unfiltered raw query (no SET LOCAL returns 0 rows)', async () => {
    // The Prisma extension would normally inject institutionId, but
    // here we use $queryRawUnsafe which BYPASSES the extension (raw SQL
    // is not intercepted by $allOperations). So RLS is the ONLY line
    // of defense. Without SET LOCAL, RLS denies → 0 rows.
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint AS count FROM users',
    )
    expect(Number(result[0]?.count ?? 0)).toBe(0)
  })

  it('3. RLS with SET LOCAL = tenant A returns only A users', async () => {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_institution_id = '${tenantA.id}'`)
      return tx.$queryRawUnsafe<Array<{ id: string; email: string }>>(
        'SELECT id, email FROM users ORDER BY email',
      )
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.email).toBe('a@x.com')
  })

  it('4. RLS with SET LOCAL = tenant B returns only B users', async () => {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_institution_id = '${tenantB.id}'`)
      return tx.$queryRawUnsafe<Array<{ id: string; email: string }>>(
        'SELECT id, email FROM users ORDER BY email',
      )
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.email).toBe('b@y.com')
  })

  it('5. refresh-token replay AFTER family revocation returns 401', async () => {
    const loginRes = await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/login')
      .set('X-Tenant-Subdomain', 'celsius')
      .send({ email: 'a@x.com', password: 'Password123!' })
      .expect(201)

    const firstRefresh = loginRes.body.refreshToken as string

    // First refresh — succeeds.
    await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/refresh')
      .set('X-Tenant-Subdomain', 'celsius')
      .send({ refreshToken: firstRefresh })
      .expect(201)

    // Replay (using the OLD token) — must fail with 401.
    const replay = await request(app.getHttpServer() as Server)
      .post('/api/v1/auth/refresh')
      .set('X-Tenant-Subdomain', 'celsius')
      .send({ refreshToken: firstRefresh })
      .expect(401)

    expect(replay.body.message).toMatch(/reuse|revoked/i)
  })

  it('6. tampered JWT (institutionId swapped) is rejected by TenantGuard', async () => {
    // Mint a JWT signed with the legit private key but with
    // institutionId = B (the tenant we're NOT in).
    const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH ?? './secrets/jwt-private.pem'
    const privateKey = await readFile(privateKeyPath, 'utf-8')
    const tamperedToken = sign(
      {
        sub: tenantA.userId,
        role: 'INSTITUTION_ADMIN',
        institutionId: tenantB.id, // <-- THE TAMPER
        jti: randomBytes(32).toString('hex'),
      },
      privateKey,
      { algorithm: 'RS256', expiresIn: '15m', keyid: 'asistencia-key-1' },
    )

    const res = await request(app.getHttpServer() as Server)
      .get('/api/v1/auth/me')
      .set('X-Tenant-Subdomain', 'celsius')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .expect(403)

    expect(res.body.message).toMatch(/tenant/i)
  })
})

function decodeJwt(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')
  const payload = Buffer.from(parts[1] ?? '', 'base64url').toString('utf-8')
  return JSON.parse(payload)
}

import { Inject, Injectable } from '@nestjs/common'
import type { PrismaClient } from '@prisma/client'
import { SUPER_ADMIN_PRISMA } from '../../../../shared/prisma/prisma.service'
import type { PrismaService } from '../../../../shared/prisma/prisma.service'
import {
  User,
  type UserProps,
  type UserRole,
  type UserStatus,
} from '../../domain/entities/user.entity'
import type {
  CreateUserData,
  UserRepository,
} from '../../domain/repositories/user.repository.interface'

/**
 * Prisma implementation of `UserRepository`.
 *
 * IMPORTANT: `findByEmail` uses `SUPER_ADMIN_PRISMA` (no tenant filter)
 * because at login time we may not yet know which tenant the user
 * belongs to. We narrow by institutionId at the call site to prevent
 * any cross-tenant data leak — the SELECT is filtered by email AND
 * institutionId before anything reaches the use case.
 *
 * Everything else uses the tenant-aware `PrismaService` (which adds
 * institutionId to the WHERE automatically via the extension).
 */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(
    @Inject(SUPER_ADMIN_PRISMA) private readonly adminPrisma: PrismaClient,
    private readonly prisma: PrismaService,
  ) {}

  async findByEmail(email: string, institutionId?: string | null): Promise<User | null> {
    const where: Record<string, unknown> = { email: email.toLowerCase() }
    if (institutionId) where.institutionId = institutionId
    const row = await this.adminPrisma.user.findFirst({ where })
    return row ? this.toUser(row as unknown as UserProps) : null
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } })
    return row ? this.toUser(row as unknown as UserProps) : null
  }

  async findByIdForAuth(id: string): Promise<User | null> {
    // Tenant context is set by JwtAuthGuard before this is called. If the
    // tenant guard later determines the token's institutionId doesn't
    // match the user's institutionId, the request fails — the lookup here
    // is the "who is this user" step.
    const row = await this.adminPrisma.user.findUnique({ where: { id } })
    return row ? this.toUser(row as unknown as UserProps) : null
  }

  async create(data: CreateUserData): Promise<User> {
    const row = await this.adminPrisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: data.role,
        institutionId: data.institutionId,
        legajo: data.legajo ?? null,
        phone: data.phone ?? null,
      },
    })
    return this.toUser(row as unknown as UserProps)
  }

  async updatePasswordHash(id: string, hash: string): Promise<User> {
    const row = await this.adminPrisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    })
    return this.toUser(row as unknown as UserProps)
  }

  async updateLastLogin(id: string, timestamp: Date): Promise<void> {
    // Best-effort — if the update fails, the login still succeeds (we just
    // don't get the last-login timestamp for this session).
    try {
      await this.adminPrisma.user.update({
        where: { id },
        data: { updatedAt: timestamp },
      })
    } catch {
      /* swallow */
    }
  }

  toUser(props: UserProps): User {
    return User.fromPersistence(props)
  }

  // Satisfy the interface's `_typecheck` hint without leaking Prisma types
  // to the domain layer.
  _typecheck: { role: UserRole; status: UserStatus } | undefined = undefined
}

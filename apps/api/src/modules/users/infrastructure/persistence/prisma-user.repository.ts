import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../shared/prisma/prisma.service'
import {
  User,
  type UserProps,
  type UserRole,
  type UserStatus,
} from '../../../auth/domain/entities/user.entity'
import type {
  CreateUserInput,
  IUserRepository,
  ListUsersInput,
  ListUsersResult,
  UpdateUserInput,
} from '../../domain/repositories/user.repository.interface'

/**
 * We use `Record<string, unknown>` instead of `Prisma.UserWhereInput`
 * for the inline WHERE shapes because the Prisma client's type for
 * `UserWhereInput` is internal and not re-exported from the top-level
 * `Prisma` namespace. The cast is safe because we know the field
 * names match the Prisma model.
 */
type UserWhereInput = Record<string, unknown>
type UserUpdateInput = Record<string, unknown>

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  private readonly logger = new Logger(PrismaUserRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { id },
    })
    return row ? this.toEntity(row as unknown as UserProps) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    })
    return row ? this.toEntity(row as unknown as UserProps) : null
  }

  async list(input: ListUsersInput): Promise<ListUsersResult> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
    const where: UserWhereInput = {}
    if (input.role) where.role = input.role
    if (input.isActive !== null && input.isActive !== undefined) {
      where.status = input.isActive ? 'ACTIVE' : 'INACTIVE'
    }
    if (input.search) {
      const q = input.search.trim()
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { legajo: { contains: q, mode: 'insensitive' } },
      ]
    }

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit
    const slice = hasMore ? rows.slice(0, limit) : rows
    const lastId = slice.length > 0 ? slice[slice.length - 1]!.id : null

    return {
      data: slice.map((r: unknown) => this.toEntity(r as UserProps)),
      nextCursor: hasMore && lastId ? lastId : null,
      hasMore,
    }
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        role: input.role,
        legajo: input.legajo ?? null,
        phone: input.phone ?? null,
        birthDate: input.birthDate ?? null,
        career: input.career ?? null,
      },
    })
    return this.toEntity(row as unknown as UserProps)
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const data: UserUpdateInput = {}
    if (input.fullName !== undefined) data.fullName = input.fullName
    if (input.email !== undefined) data.email = input.email.toLowerCase()
    if (input.role !== undefined) data.role = input.role
    if (input.isActive !== undefined) {
      data.status = input.isActive ? 'ACTIVE' : 'INACTIVE'
    }
    if (input.phone !== undefined) data.phone = input.phone
    if (input.legajo !== undefined) data.legajo = input.legajo

    const row = await this.prisma.user.update({
      where: { id },
      data,
    })
    return this.toEntity(row as unknown as UserProps)
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { status: isActive ? 'ACTIVE' : 'INACTIVE' },
    })
    return this.toEntity(row as unknown as UserProps)
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    })
    return this.toEntity(row as unknown as UserProps)
  }

  async countByRole(role: UserRole): Promise<number> {
    return this.prisma.user.count({ where: { role, status: 'ACTIVE' } })
  }

  toEntity(props: UserProps): User {
    return User.fromPersistence(props)
  }

  // Satisfy the interface's `_typecheck` hint.
  _typecheck: { role: UserRole; status: UserStatus } | undefined = undefined
}

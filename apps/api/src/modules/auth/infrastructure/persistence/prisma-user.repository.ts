import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/prisma/prisma.service'
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

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({ where: { email: email.toLowerCase() } })
    return row ? this.toUser(row as unknown as UserProps) : null
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } })
    return row ? this.toUser(row as unknown as UserProps) : null
  }

  async create(data: CreateUserData): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: data.role,
        legajo: data.legajo ?? null,
        phone: data.phone ?? null,
      },
    })
    return this.toUser(row as unknown as UserProps)
  }

  async updatePasswordHash(id: string, hash: string): Promise<User> {
    const row = await this.prisma.user.update({ where: { id }, data: { passwordHash: hash } })
    return this.toUser(row as unknown as UserProps)
  }

  async updateLastLogin(id: string, timestamp: Date): Promise<void> {
    try {
      await this.prisma.user.update({ where: { id }, data: { updatedAt: timestamp } })
    } catch {
      /* swallow */
    }
  }

  toUser(props: UserProps): User {
    return User.fromPersistence(props)
  }

  _typecheck: { role: UserRole; status: UserStatus } | undefined = undefined
}

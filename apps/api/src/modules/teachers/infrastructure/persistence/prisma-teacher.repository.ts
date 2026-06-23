import { Injectable, Logger } from '@nestjs/common'
import type { PrismaService } from '../../../../shared/prisma/prisma.service'
import type { User } from '../../../auth/domain/entities/user.entity'
import { Teacher } from '../../domain/entities/teacher.entity'
import type {
  CreateTeacherInput,
  ITeacherRepository,
  ListTeachersInput,
  ListTeachersResult,
  UpdateTeacherInput,
} from '../../domain/repositories/teacher.repository.interface'

type UserWhereInput = Record<string, unknown>
type UserUpdateInput = Record<string, unknown>

/**
 * Prisma implementation of `ITeacherRepository`. Filters the
 * `User` table by `role = TEACHER` within the caller's institution
 * and projects the rows to the `Teacher` domain entity.
 *
 * The teacher table is a virtual view — there's no separate
 * Prisma model for teachers. This keeps the schema simple and
 * avoids the cost of a join.
 */
@Injectable()
export class PrismaTeacherRepository implements ITeacherRepository {
  private readonly logger = new Logger(PrismaTeacherRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  async findByIdInInstitution(institutionId: string, id: string): Promise<Teacher | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, institutionId, role: 'TEACHER' },
    })
    return row ? Teacher.fromUser(row as unknown as User) : null
  }

  async findByEmailInInstitution(institutionId: string, email: string): Promise<Teacher | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), institutionId, role: 'TEACHER' },
    })
    return row ? Teacher.fromUser(row as unknown as User) : null
  }

  async listInInstitution(
    institutionId: string,
    input: ListTeachersInput,
  ): Promise<ListTeachersResult> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
    const where: UserWhereInput = { institutionId, role: 'TEACHER' }
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
      data: slice.map((r: unknown) => Teacher.fromUser(r as User)),
      nextCursor: hasMore && lastId ? lastId : null,
      hasMore,
    }
  }

  async createInInstitution(input: CreateTeacherInput): Promise<Teacher> {
    const row = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        role: 'TEACHER',
        institutionId: input.institutionId,
        legajo: input.legajo ?? null,
        phone: input.phone ?? null,
      },
    })
    return Teacher.fromUser(row as unknown as User)
  }

  async updateInInstitution(
    institutionId: string,
    id: string,
    input: UpdateTeacherInput,
  ): Promise<Teacher> {
    const data: UserUpdateInput = {}
    if (input.fullName !== undefined) data.fullName = input.fullName
    if (input.email !== undefined) data.email = input.email.toLowerCase()
    if (input.isActive !== undefined) {
      data.status = input.isActive ? 'ACTIVE' : 'INACTIVE'
    }
    if (input.phone !== undefined) data.phone = input.phone
    if (input.legajo !== undefined) data.legajo = input.legajo

    const row = await this.prisma.user.update({
      where: { id, institutionId, role: 'TEACHER' },
      data,
    })
    return Teacher.fromUser(row as unknown as User)
  }

  async setActiveInInstitution(
    institutionId: string,
    id: string,
    isActive: boolean,
  ): Promise<Teacher> {
    const row = await this.prisma.user.update({
      where: { id, institutionId, role: 'TEACHER' },
      data: { status: isActive ? 'ACTIVE' : 'INACTIVE' },
    })
    return Teacher.fromUser(row as unknown as User)
  }
}

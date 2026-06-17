import { Injectable, Logger } from '@nestjs/common'
import type { PrismaService } from '../../../../shared/prisma/prisma.service'
import { Subject, type SubjectProps } from '../../domain/entities/subject.entity'
import type {
  CreateSubjectInput,
  ISubjectRepository,
  ListSubjectsInput,
  ListSubjectsResult,
  UpdateSubjectInput,
} from '../../domain/repositories/subject.repository.interface'

/**
 * Prisma implementation of `ISubjectRepository`. Uses the
 * tenant-aware `PrismaService` so the extension automatically
 * injects `institutionId` into every WHERE clause.
 */
@Injectable()
export class PrismaSubjectRepository implements ISubjectRepository {
  private readonly logger = new Logger(PrismaSubjectRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  async findByIdInInstitution(institutionId: string, id: string): Promise<Subject | null> {
    const row = await this.prisma.subject.findFirst({ where: { id, institutionId } })
    return row ? this.toEntity(row) : null
  }

  async findByCodeInInstitution(institutionId: string, code: string): Promise<Subject | null> {
    // Citext is case-insensitive at the DB layer.
    const row = await this.prisma.subject.findFirst({
      where: { institutionId, code: code.toUpperCase() },
    })
    return row ? this.toEntity(row) : null
  }

  async listInInstitution(
    institutionId: string,
    input: ListSubjectsInput,
  ): Promise<ListSubjectsResult> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
    const where: Record<string, unknown> = { institutionId }
    if (input.search) {
      const q = input.search.trim()
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    }

    const rows = await this.prisma.subject.findMany({
      where,
      orderBy: { code: 'asc' },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit
    const slice = hasMore ? rows.slice(0, limit) : rows
    const lastId = slice.length > 0 ? slice[slice.length - 1]!.id : null

    return {
      data: slice.map((r: Record<string, unknown>) => this.toEntity(r)),
      nextCursor: hasMore && lastId ? lastId : null,
      hasMore,
    }
  }

  async createInInstitution(input: CreateSubjectInput): Promise<Subject> {
    const row = await this.prisma.subject.create({
      data: {
        institutionId: input.institutionId,
        code: input.code.toUpperCase(),
        name: input.name,
        description: input.description ?? null,
      },
    })
    return this.toEntity(row)
  }

  async updateInInstitution(
    institutionId: string,
    id: string,
    input: UpdateSubjectInput,
  ): Promise<Subject> {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.description !== undefined) data.description = input.description

    const row = await this.prisma.subject.update({
      where: { id, institutionId },
      data,
    })
    return this.toEntity(row)
  }

  async setDeletedInInstitution(institutionId: string, id: string): Promise<Subject> {
    const row = await this.prisma.subject.update({
      where: { id, institutionId },
      data: { deletedAt: new Date() },
    })
    return this.toEntity(row)
  }

  async countActiveCoursesInInstitution(institutionId: string, id: string): Promise<number> {
    return this.prisma.course.count({
      where: { institutionId, subjectId: id, deletedAt: null },
    })
  }

  private toEntity(row: Record<string, unknown>): Subject {
    return Subject.fromPersistence({
      id: row.id as string,
      institutionId: row.institutionId as string,
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      createdAt: row.createdAt as Date | undefined,
      updatedAt: row.updatedAt as Date | undefined,
      deletedAt: (row.deletedAt as Date | null) ?? null,
    } as SubjectProps)
  }
}

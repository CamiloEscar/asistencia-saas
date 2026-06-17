import { Injectable, Logger } from '@nestjs/common'
import type { PrismaService } from '../../../../shared/prisma/prisma.service'
import { ClassSession, type ClassSessionProps } from '../../domain/entities/class-session.entity'
import {
  type GetOrCreateSessionInput,
  type IClassSessionRepository,
  type ListClassSessionsInput,
  type ListClassSessionsResult,
} from '../../domain/repositories/class-session.repository.interface'

/**
 * Prisma implementation of `IClassSessionRepository`.
 *
 * The session's `scheduledAt` is a UTC TIMESTAMPTZ. For get-or-
 * create-by-date, the caller passes a Date that represents the
 * "day start" in the institution's timezone (computed by the
 * use case with Luxon). The repo then derives the day end as
 * day start + 24h and queries the session in that window.
 *
 * Get-or-create is wrapped in `forTenant` so the find + create
 * run in a single transaction — concurrent first-marks for the
 * same (course, day) won't create duplicate sessions.
 */
@Injectable()
export class PrismaClassSessionRepository implements IClassSessionRepository {
  private readonly logger = new Logger(PrismaClassSessionRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  async findByIdInInstitution(institutionId: string, id: string): Promise<ClassSession | null> {
    const row = await this.prisma.classSession.findFirst({
      where: { id, institutionId },
    })
    return row ? this.toEntity(row) : null
  }

  async findByCourseAndDate(
    institutionId: string,
    courseId: string,
    scheduledAt: Date,
  ): Promise<ClassSession | null> {
    const { dayStart, dayEnd } = this.dayWindow(scheduledAt)
    const row = await this.prisma.classSession.findFirst({
      where: {
        institutionId,
        courseId,
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
    })
    return row ? this.toEntity(row) : null
  }

  async getOrCreateForCourseAndDate(input: GetOrCreateSessionInput): Promise<ClassSession> {
    return this.prisma.forTenant(input.institutionId, async (tx) => {
      const { dayStart, dayEnd } = this.dayWindow(input.scheduledAt)
      // First, attempt find. UNIQUE (courseId, scheduledAt) keeps
      // this safe: only one row can exist for the exact
      // (courseId, dayStart) pair, and the day window catches any
      // session scheduled at any time during that calendar day.
      const existing = await tx.classSession.findFirst({
        where: {
          institutionId: input.institutionId,
          courseId: input.courseId,
          scheduledAt: { gte: dayStart, lt: dayEnd },
        },
      })
      if (existing) {
        return this.toEntity(existing)
      }
      const created = await tx.classSession.create({
        data: {
          institutionId: input.institutionId,
          courseId: input.courseId,
          scheduledAt: dayStart,
          durationMin: input.durationMin,
          topic: input.topic ?? null,
          status: 'SCHEDULED',
          createdBy: input.createdBy,
        },
      })
      this.logger.debug(
        `getOrCreateForCourseAndDate: created session=${created.id} for course=${input.courseId} on ${dayStart.toISOString()}`,
      )
      return this.toEntity(created)
    })
  }

  async listInInstitution(
    institutionId: string,
    input: ListClassSessionsInput,
  ): Promise<ListClassSessionsResult> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
    const where: Record<string, unknown> = { institutionId }
    if (input.courseId) where.courseId = input.courseId
    if (input.status) where.status = input.status
    if (input.dateFrom || input.dateTo) {
      where.scheduledAt = {
        ...(input.dateFrom ? { gte: input.dateFrom } : {}),
        ...(input.dateTo ? { lte: input.dateTo } : {}),
      }
    }

    const rows = await this.prisma.classSession.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
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

  async markCompleted(id: string): Promise<ClassSession> {
    const row = await this.prisma.classSession.update({
      where: { id },
      data: { status: 'COMPLETED' },
    })
    return this.toEntity(row)
  }

  async isTeacherAssignedToCourse(
    institutionId: string,
    teacherId: string,
    courseId: string,
  ): Promise<boolean> {
    const found = await this.prisma.courseTeacher.findFirst({
      where: { institutionId, courseId, teacherId },
      select: { id: true },
    })
    return found !== null
  }

  async getCourseDefaultDuration(institutionId: string, courseId: string): Promise<number | null> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, institutionId },
      select: { defaultSessionDurationMin: true },
    })
    return course?.defaultSessionDurationMin ?? null
  }

  // ─── helpers ─────────────────────────────────────────────────────────

  /**
   * Given a Date, compute the [dayStart, dayEnd) window in UTC.
   * The use case is responsible for passing a `scheduledAt` that
   * represents the institution's local day start (00:00 local).
   * This helper simply normalises to a 24h window starting there.
   */
  private dayWindow(scheduledAt: Date): { dayStart: Date; dayEnd: Date } {
    const dayStart = new Date(scheduledAt)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    return { dayStart, dayEnd }
  }

  private toEntity(row: Record<string, unknown>): ClassSession {
    return ClassSession.fromPersistence({
      id: row.id as string,
      institutionId: row.institutionId as string,
      courseId: row.courseId as string,
      scheduledAt: row.scheduledAt as Date,
      durationMin: row.durationMin as number,
      topic: (row.topic as string | null) ?? null,
      status: row.status as string,
      createdBy: row.createdBy as string,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
    } as ClassSessionProps)
  }
}

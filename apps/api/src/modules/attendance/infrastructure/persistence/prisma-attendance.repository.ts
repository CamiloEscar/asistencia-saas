import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import type { PrismaService } from '../../../../shared/prisma/prisma.service'
import { Attendance, type AttendanceProps } from '../../domain/entities/attendance.entity'
import {
  ATTENDANCE_STATUSES,
  AttendanceStatus,
  type AttendanceStatusValue,
} from '../../domain/value-objects/attendance-status.vo'
import { JustificationText } from '../../domain/value-objects/justification-text.vo'
import {
  type AttendanceRecordInput,
  type AttendanceSummary,
  type BulkUpsertResult,
  type IAttendanceRepository,
  type ListAttendanceInput,
  type ListAttendanceResult,
  type StudentAttendanceSummary,
  type UpdateAttendanceInput,
} from '../../domain/repositories/attendance.repository.interface'

/**
 * Prisma implementation of `IAttendanceRepository`. Uses the
 * tenant-aware `PrismaService` so the `institutionId` is
 * injected automatically. For multi-statement transactions (bulk
 * upsert) we additionally wrap in `forTenant` so RLS is active
 * for every statement (defense-in-depth per design §2.1).
 *
 * **Performance notes** (per design §9.1):
 *   - bulk upsert: find existing + createMany + per-row update,
 *     all in one transaction. Typical 60-student class = ~62
 *     round-trips inside a single TX → well under 50ms on a
 *     healthy network.
 *   - summaryByCourse: groupBy on `(institutionId, recordedAt)`
 *     index. <100ms for 1M rows.
 *   - summaryByStudent: load + aggregate in JS (for per-course
 *     breakdown). For typical semester (300 records) < 25ms.
 *     Will be replaced with a materialized view in Hito 2.
 */
@Injectable()
export class PrismaAttendanceRepository implements IAttendanceRepository {
  private readonly logger = new Logger(PrismaAttendanceRepository.name)

  constructor(private readonly prisma: PrismaService) {}

  // ─── Reads ───────────────────────────────────────────────────────────

  async findByIdInInstitution(institutionId: string, id: string): Promise<Attendance | null> {
    const row = await this.prisma.attendanceRecord.findFirst({
      where: { id, institutionId },
    })
    return row ? this.toEntity(row) : null
  }

  async listInInstitution(
    institutionId: string,
    input: ListAttendanceInput,
  ): Promise<ListAttendanceResult> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
    const where: Record<string, unknown> = { institutionId }
    if (input.status) where.status = input.status
    if (input.studentId) where.studentId = input.studentId
    if (input.sessionId) where.sessionId = input.sessionId
    if (input.dateFrom || input.dateTo) {
      where.recordedAt = {
        ...(input.dateFrom ? { gte: input.dateFrom } : {}),
        ...(input.dateTo ? { lte: input.dateTo } : {}),
      }
    }
    if (input.courseId) {
      // Filter by joining the session's course. The
      // `(institutionId, courseId)` index on class_sessions keeps
      // this fast.
      where.session = { courseId: input.courseId }
    }

    // Role-based filter: TEACHER sees only their courses; STUDENT
    // sees only their own records. ADMIN sees everything.
    if (input.forRole === 'TEACHER' && input.forUserId) {
      const assignments = await this.prisma.courseTeacher.findMany({
        where: { teacherId: input.forUserId, institutionId },
        select: { courseId: true },
      })
      const courseIds = assignments.map((a: { courseId: string }) => a.courseId)
      if (courseIds.length === 0) return { data: [], nextCursor: null, hasMore: false }
      where.session = { ...(where.session as object | undefined), courseId: { in: courseIds } }
    } else if (input.forRole === 'STUDENT' && input.forUserId) {
      // For students, force the studentId to be their own id —
      // they cannot query anyone else's records (REQ-ATT-003-02).
      where.studentId = input.forUserId
    }

    const rows = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
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

  // ─── Writes ──────────────────────────────────────────────────────────

  async bulkCreateOrUpdate(input: {
    sessionId: string
    institutionId: string
    recordedBy: string
    records: AttendanceRecordInput[]
  }): Promise<BulkUpsertResult> {
    if (input.records.length === 0) {
      return { created: 0, updated: 0, recordIds: [] }
    }

    return this.prisma.forTenant(input.institutionId, async (tx) => {
      // 1. Find the existing rows for this session + the given
      //    students. We need their ids to issue updates; the
      //    UNIQUE (sessionId, studentId) is the lookup key.
      const studentIds = Array.from(new Set(input.records.map((r) => r.studentId)))
      const existing = await tx.attendanceRecord.findMany({
        where: { sessionId: input.sessionId, studentId: { in: studentIds } },
        select: { id: true, studentId: true },
      })
      const existingByStudent = new Map(
        existing.map((r: { id: string; studentId: string }) => [r.studentId, r.id] as const),
      )
      const existingIds = existing.map((r: { id: string }) => r.id)

      // 2. Partition the input into new vs existing.
      const newRows = input.records.filter((r) => !existingByStudent.has(r.studentId))
      const updateRows = input.records.filter((r) => existingByStudent.has(r.studentId))

      // 3. Insert new rows in a single createMany (skipDuplicates is
      //    belt-and-suspenders against a race that inserted between
      //    the findMany and now).
      let createdIds: string[] = []
      if (newRows.length > 0) {
        await tx.attendanceRecord.createMany({
          data: newRows.map((r: AttendanceRecordInput) => ({
            institutionId: input.institutionId,
            sessionId: input.sessionId,
            studentId: r.studentId,
            status: r.status,
            justificationText: r.justificationText ?? null,
            recordedBy: input.recordedBy,
          })),
          skipDuplicates: true,
        })
        // Re-read the newly created rows to capture their ids.
        const created = await tx.attendanceRecord.findMany({
          where: {
            sessionId: input.sessionId,
            studentId: { in: newRows.map((r: AttendanceRecordInput) => r.studentId) },
            id: { notIn: existingIds },
          },
          select: { id: true, studentId: true },
        })
        createdIds = created.map((r: { id: string }) => r.id)
      }

      // 4. For existing rows, we MUST issue per-row updates because
      //    each row may carry a different status / justification.
      //    Loop inside the same transaction keeps it atomic and
      //    within the row-lock window.
      const updatedIds: string[] = []
      for (const r of updateRows) {
        const id = existingByStudent.get(r.studentId)
        if (!id) continue
        const updated = await tx.attendanceRecord.update({
          where: { id },
          data: {
            status: r.status,
            justificationText: r.justificationText ?? null,
            recordedBy: input.recordedBy,
          },
          select: { id: true },
        })
        updatedIds.push(updated.id)
      }

      this.logger.debug(
        `bulkCreateOrUpdate: session=${input.sessionId} created=${createdIds.length} updated=${updatedIds.length}`,
      )

      return {
        created: createdIds.length,
        updated: updatedIds.length,
        recordIds: [...createdIds, ...updatedIds],
      }
    })
  }

  async updateByIdInInstitution(
    institutionId: string,
    id: string,
    input: UpdateAttendanceInput,
    _byUser: string,
  ): Promise<Attendance> {
    const data: Record<string, unknown> = {}
    if (input.status !== undefined) data.status = input.status
    if (input.justificationText !== undefined) {
      data.justificationText = input.justificationText
    }
    if (input.evidenceUrl !== undefined) {
      data.evidenceUrl = input.evidenceUrl
    }
    const row = await this.prisma.attendanceRecord.update({
      where: { id, institutionId },
      data,
    })
    return this.toEntity(row)
  }

  // ─── Aggregations ────────────────────────────────────────────────────

  async summaryByCourse(
    institutionId: string,
    courseId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<AttendanceSummary> {
    const where: Record<string, unknown> = {
      institutionId,
      session: { courseId },
    }
    if (dateRange?.from || dateRange?.to) {
      where.recordedAt = {
        ...(dateRange.from ? { gte: dateRange.from } : {}),
        ...(dateRange.to ? { lte: dateRange.to } : {}),
      }
    }

    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    })
    return this.buildSummary(grouped as Array<{ status: string; _count: { _all: number } }>)
  }

  async summaryByStudent(
    institutionId: string,
    studentId: string,
    courseId?: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<StudentAttendanceSummary> {
    // For per-course breakdown, load the rows (with session.courseId)
    // and aggregate in JS. For a typical student (300 records per
    // semester) this is < 25ms.
    const where: Record<string, unknown> = {
      institutionId,
      studentId,
    }
    if (courseId) {
      where.session = { courseId }
    }
    if (dateRange?.from || dateRange?.to) {
      where.recordedAt = {
        ...(dateRange.from ? { gte: dateRange.from } : {}),
        ...(dateRange.to ? { lte: dateRange.to } : {}),
      }
    }

    const rows = await this.prisma.attendanceRecord.findMany({
      where,
      select: {
        status: true,
        session: {
          select: {
            courseId: true,
            course: { select: { code: true, name: true } },
          },
        },
      },
    })

    // Aggregate overall
    const overallCounts = new Map<AttendanceStatusValue, number>()
    for (const r of rows) {
      const s = r.status as AttendanceStatusValue
      overallCounts.set(s, (overallCounts.get(s) ?? 0) + 1)
    }
    const overall = this.countsToSummary(overallCounts)

    // Per-course breakdown — only when no specific courseId was asked
    let byCourse: StudentAttendanceSummary['byCourse']
    if (!courseId) {
      const byCourseMap = new Map<
        string,
        { code: string; name: string; counts: Map<AttendanceStatusValue, number> }
      >()
      for (const r of rows) {
        const cid = r.session.courseId
        if (!byCourseMap.has(cid)) {
          byCourseMap.set(cid, {
            code: r.session.course.code,
            name: r.session.course.name,
            counts: new Map(),
          })
        }
        const entry = byCourseMap.get(cid)!
        const s = r.status as AttendanceStatusValue
        entry.counts.set(s, (entry.counts.get(s) ?? 0) + 1)
      }
      byCourse = Array.from(byCourseMap.entries()).map(
        ([cid, { code, name, counts }]) => ({
          courseId: cid,
          courseCode: code,
          courseName: name,
          summary: this.countsToSummary(counts),
        }),
      )
    }

    return { ...overall, ...(byCourse ? { byCourse } : {}) }
  }

  async summaryByTeacher(
    institutionId: string,
    teacherId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<AttendanceSummary> {
    // Find the courses the teacher is assigned to, then aggregate
    // attendance across all of them.
    const assignments = await this.prisma.courseTeacher.findMany({
      where: { teacherId, institutionId },
      select: { courseId: true },
    })
    const courseIds = assignments.map((a: { courseId: string }) => a.courseId)
    if (courseIds.length === 0) {
      return this.emptySummary()
    }

    const where: Record<string, unknown> = {
      institutionId,
      session: { courseId: { in: courseIds } },
    }
    if (dateRange?.from || dateRange?.to) {
      where.recordedAt = {
        ...(dateRange.from ? { gte: dateRange.from } : {}),
        ...(dateRange.to ? { lte: dateRange.to } : {}),
      }
    }

    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    })
    return this.buildSummary(grouped as Array<{ status: string; _count: { _all: number } }>)
  }

  // ─── Cross-tenant validation helpers ─────────────────────────────────

  async validateStudentsEnrolledInCourse(courseId: string, studentIds: string[]): Promise<void> {
    if (studentIds.length === 0) return
    const enrolled = await this.prisma.enrollment.findMany({
      where: { courseId, studentId: { in: studentIds } },
      select: { studentId: true },
    })
    const enrolledSet = new Set(enrolled.map((e: { studentId: string }) => e.studentId))
    const missing = studentIds.filter((id) => !enrolledSet.has(id))
    if (missing.length > 0) {
      throw new BadRequestException({
        message: `Student(s) not enrolled in this course: ${missing.join(', ')}`,
        error: 'Bad Request',
        field: 'records',
        notEnrolled: missing,
      })
    }
  }

  // ─── helpers ─────────────────────────────────────────────────────────

  private buildSummary(
    grouped: Array<{ status: string; _count: { _all: number } }>,
  ): AttendanceSummary {
    const counts = new Map<AttendanceStatusValue, number>()
    for (const s of ATTENDANCE_STATUSES) counts.set(s, 0)
    let total = 0
    for (const row of grouped) {
      const s = row.status as AttendanceStatusValue
      const c = row._count._all
      counts.set(s, c)
      total += c
    }
    return this.countsToSummary(counts, total)
  }

  private countsToSummary(
    counts: Map<AttendanceStatusValue, number>,
    preTotal?: number,
  ): AttendanceSummary {
    const present = counts.get('PRESENT') ?? 0
    const absent = counts.get('ABSENT') ?? 0
    const late = counts.get('LATE') ?? 0
    const justified = counts.get('JUSTIFIED') ?? 0
    const total = preTotal ?? present + absent + late + justified
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0)
    return {
      present,
      absent,
      late,
      justified,
      total,
      percentages: {
        present: pct(present),
        absent: pct(absent),
        late: pct(late),
        justified: pct(justified),
      },
    }
  }

  private emptySummary(): AttendanceSummary {
    return {
      present: 0,
      absent: 0,
      late: 0,
      justified: 0,
      total: 0,
      percentages: { present: 0, absent: 0, late: 0, justified: 0 },
    }
  }

  private toEntity(row: Record<string, unknown>): Attendance {
    return Attendance.fromPersistence({
      id: row.id as string,
      institutionId: row.institutionId as string,
      sessionId: row.sessionId as string,
      studentId: row.studentId as string,
      status: row.status as string,
      justificationText: (row.justificationText as string | null) ?? null,
      recordedBy: row.recordedBy as string,
      recordedAt: row.recordedAt as Date,
      updatedAt: row.updatedAt as Date,
      evidenceUrl: (row.evidenceUrl as string | null | undefined) ?? null,
    } as AttendanceProps)
  }
}

// Silence "value never read" warnings for the VOs that are used
// only by the use case layer (imported here so the symbol is
// available for the entity construction in the same file).
void AttendanceStatus
void JustificationText

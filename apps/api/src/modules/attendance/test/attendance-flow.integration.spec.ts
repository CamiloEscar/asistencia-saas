/**
 * Integration test for the attendance flow. Uses in-memory
 * implementations of the repository interfaces to exercise the
 * end-to-end behavior of the use cases without a real DB.
 *
 * Mirrors the pattern from `bulk-import-students.integration.spec.ts`:
 * a class implementing the repo interface, in-memory state,
 * the use case instantiated directly.
 *
 * Covers (per task 11.9 spec):
 *  - Full mark-attendance flow (mark → counts → summary)
 *  - Same-day enforcement for teachers
 *  - Admin override of past dates
 *  - Cross-tenant isolation
 *  - Evidence upload (with stubbed Cloudinary)
 *  - Bulk idempotency (mark twice → no duplicates)
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { DateTime } from 'luxon'
import { enterTenantContext } from '../../../shared/tenant/tenant.context'
import { MarkAttendanceUseCase } from '../application/use-cases/mark-attendance.use-case'
import { ModifyAttendanceUseCase } from '../application/use-cases/modify-attendance.use-case'
import { ListAttendanceUseCase } from '../application/use-cases/list-attendance.use-case'
import { AttendanceSummaryUseCase } from '../application/use-cases/attendance-summary.use-case'
import { GetAttendanceUseCase } from '../application/use-cases/get-attendance.use-case'
import { UploadEvidenceUseCase } from '../application/use-cases/upload-evidence.use-case'
import type {
  AttendanceRecordInput,
  BulkUpsertResult,
  IAttendanceRepository,
  UpdateAttendanceInput,
} from '../domain/repositories/attendance.repository.interface'
import type { IClassSessionRepository } from '../domain/repositories/class-session.repository.interface'
import type { ClassSession } from '../domain/entities/class-session.entity'
import type { Attendance } from '../domain/entities/attendance.entity'
import type { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service'

// ─── In-memory attendance repository ──────────────────────────────────────

class InMemoryAttendanceRepo implements IAttendanceRepository {
  private next = 1
  private rows = new Map<string, Record<string, unknown>>()

  toEntity(r: Record<string, unknown>): Attendance {
    return {
      id: r.id as string,
      institutionId: r.institutionId as string,
      sessionId: r.sessionId as string,
      studentId: r.studentId as string,
      status: r.status as string,
      justification: { value: r.justificationText ?? null, isEmpty: !r.justificationText } as never,
      recordedBy: r.recordedBy as string,
      recordedAt: r.recordedAt as Date,
      updatedAt: r.updatedAt as Date,
      evidenceUrl: (r.evidenceUrl as string | null) ?? null,
      toPublicJson: () => ({
        id: r.id as string,
        sessionId: r.sessionId as string,
        studentId: r.studentId as string,
        status: r.status as string,
        justificationText: (r.justificationText as string | null) ?? null,
        evidenceUrl: (r.evidenceUrl as string | null) ?? null,
        recordedBy: r.recordedBy as string,
        recordedAt: r.recordedAt as Date,
        updatedAt: r.updatedAt as Date,
      }),
    } as unknown as Attendance
  }

  async findByIdInInstitution(institutionId: string, id: string): Promise<Attendance | null> {
    const r = this.rows.get(id)
    return r && r.institutionId === institutionId ? this.toEntity(r) : null
  }

  async bulkCreateOrUpdate(input: {
    sessionId: string
    institutionId: string
    recordedBy: string
    records: AttendanceRecordInput[]
  }): Promise<BulkUpsertResult> {
    const created: string[] = []
    const updated: string[] = []
    for (const rec of input.records) {
      // Find existing by (sessionId, studentId) in this institution
      const existing = Array.from(this.rows.values()).find(
        (r) =>
          r.sessionId === input.sessionId &&
          r.studentId === rec.studentId &&
          r.institutionId === input.institutionId,
      )
      if (existing) {
        existing.status = rec.status
        existing.justificationText = rec.justificationText ?? null
        existing.recordedBy = input.recordedBy
        existing.updatedAt = new Date()
        updated.push(existing.id as string)
      } else {
        const id = `att-${this.next++}`
        this.rows.set(id, {
          id,
          institutionId: input.institutionId,
          sessionId: input.sessionId,
          studentId: rec.studentId,
          status: rec.status,
          justificationText: rec.justificationText ?? null,
          evidenceUrl: null,
          recordedBy: input.recordedBy,
          recordedAt: new Date(),
          updatedAt: new Date(),
        })
        created.push(id)
      }
    }
    return { created: created.length, updated: updated.length, recordIds: [...created, ...updated] }
  }

  async updateByIdInInstitution(
    institutionId: string,
    id: string,
    input: UpdateAttendanceInput,
    _byUser: string,
  ): Promise<Attendance> {
    const r = this.rows.get(id)
    if (!r || r.institutionId !== institutionId) {
      throw new NotFoundException({ message: 'Attendance not found' })
    }
    if (input.status !== undefined) r.status = input.status
    if (input.justificationText !== undefined) r.justificationText = input.justificationText
    if (input.evidenceUrl !== undefined) r.evidenceUrl = input.evidenceUrl
    r.updatedAt = new Date()
    return this.toEntity(r)
  }

  async listInInstitution(
    institutionId: string,
    input: {
      courseId?: string | null
      studentId?: string | null
      sessionId?: string | null
      status?: string | null
      dateFrom?: Date | null
      dateTo?: Date | null
      forRole?: 'ADMIN' | 'TEACHER' | 'STUDENT'
      forUserId?: string
    },
  ) {
    let rows = Array.from(this.rows.values()).filter((r) => r.institutionId === institutionId)
    if (input.studentId) rows = rows.filter((r) => r.studentId === input.studentId)
    if (input.sessionId) rows = rows.filter((r) => r.sessionId === input.sessionId)
    if (input.status) rows = rows.filter((r) => r.status === input.status)
    if (input.dateFrom) rows = rows.filter((r) => (r.recordedAt as Date) >= input.dateFrom!)
    if (input.dateTo) rows = rows.filter((r) => (r.recordedAt as Date) <= input.dateTo!)
    return {
      data: rows.map((r) => this.toEntity(r)) as never,
      nextCursor: null,
      hasMore: false,
    }
  }

  async summaryByCourse(
    institutionId: string,
    courseId: string,
    dateRange?: { from?: Date; to?: Date },
  ) {
    // Find sessions that belong to this course, then include
    // attendances that reference those sessions. (Real Prisma
    // does the same via `where: { session: { courseId } }`.)
    const sessionIds = new Set(
      Array.from(this.sessionsStore.values())
        .filter((s) => s.institutionId === institutionId && s.courseId === courseId)
        .map((s) => s.id),
    )
    let rows = Array.from(this.rows.values()).filter(
      (r) => r.institutionId === institutionId && sessionIds.has(r.sessionId as string),
    )
    if (dateRange?.from) rows = rows.filter((r) => (r.recordedAt as Date) >= dateRange.from!)
    if (dateRange?.to) rows = rows.filter((r) => (r.recordedAt as Date) <= dateRange.to!)
    return this.summarize(rows)
  }

  async summaryByStudent(
    institutionId: string,
    studentId: string,
    _courseId?: string,
    dateRange?: { from?: Date; to?: Date },
  ) {
    let rows = Array.from(this.rows.values()).filter(
      (r) => r.institutionId === institutionId && r.studentId === studentId,
    )
    if (dateRange?.from) rows = rows.filter((r) => (r.recordedAt as Date) >= dateRange.from!)
    if (dateRange?.to) rows = rows.filter((r) => (r.recordedAt as Date) <= dateRange.to!)
    return this.summarize(rows)
  }

  async summaryByTeacher(
    institutionId: string,
    _teacherId: string,
    dateRange?: { from?: Date; to?: Date },
  ) {
    let rows = Array.from(this.rows.values()).filter((r) => r.institutionId === institutionId)
    if (dateRange?.from) rows = rows.filter((r) => (r.recordedAt as Date) >= dateRange.from!)
    if (dateRange?.to) rows = rows.filter((r) => (r.recordedAt as Date) <= dateRange.to!)
    return this.summarize(rows)
  }

  async validateStudentsEnrolledInCourse(courseId: string, studentIds: string[]): Promise<void> {
    const enrolled = new Set(
      Array.from(this.enrollments.values())
        .filter((e) => e.courseId === courseId)
        .map((e) => e.studentId),
    )
    const missing = studentIds.filter((s) => !enrolled.has(s))
    if (missing.length > 0) {
      throw new BadRequestException({
        message: `Student(s) not enrolled: ${missing.join(', ')}`,
        notEnrolled: missing,
      })
    }
  }

  // Helpers used by the in-memory test fixture
  private enrollments = new Map<
    string,
    { courseId: string; studentId: string; institutionId: string }
  >()
  private sessionsStore = new Map<
    string,
    { id: string; institutionId: string; courseId: string; scheduledAt: Date; status: string }
  >()
  setEnrollment(courseId: string, studentId: string, institutionId: string) {
    this.enrollments.set(`${courseId}:${studentId}`, { courseId, studentId, institutionId })
  }
  setCourseIdForAttendance(attendanceId: string, courseId: string) {
    const r = this.rows.get(attendanceId)
    if (r) r.courseId = courseId
  }
  registerSession(s: {
    id: string
    institutionId: string
    courseId: string
    scheduledAt: Date
    status: string
  }) {
    this.sessionsStore.set(s.id, s)
  }

  private summarize(rows: Array<Record<string, unknown>>) {
    const counts: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0 }
    for (const r of rows) {
      counts[r.status as string] = (counts[r.status as string] ?? 0) + 1
    }
    const total = rows.length
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0)
    return {
      present: counts.PRESENT ?? 0,
      absent: counts.ABSENT ?? 0,
      late: counts.LATE ?? 0,
      justified: counts.JUSTIFIED ?? 0,
      total,
      percentages: {
        present: pct(counts.PRESENT ?? 0),
        absent: pct(counts.ABSENT ?? 0),
        late: pct(counts.LATE ?? 0),
        justified: pct(counts.JUSTIFIED ?? 0),
      },
    }
  }
}

// ─── In-memory class session repository ───────────────────────────────────

class InMemoryClassSessionRepo implements IClassSessionRepository {
  private next = 1
  private rows = new Map<string, Record<string, unknown>>()
  private assignments = new Set<string>()
  /** Callback fired whenever a session is created. The test wires
   *  this up so the attendance repo can join by courseId (the real
   *  Prisma does the same via `where: { session: { courseId } }`). */
  onSessionCreated:
    | ((s: {
        id: string
        institutionId: string
        courseId: string
        scheduledAt: Date
        status: string
      }) => void)
    | null = null

  toEntity(r: Record<string, unknown>): ClassSession {
    return {
      id: r.id as string,
      institutionId: r.institutionId as string,
      courseId: r.courseId as string,
      scheduledAt: r.scheduledAt as Date,
      durationMin: r.durationMin as number,
      topic: (r.topic as string | null) ?? null,
      status: r.status as string,
      createdBy: r.createdBy as string,
      createdAt: r.createdAt as Date,
      updatedAt: r.updatedAt as Date,
      toPublicJson: () => ({
        id: r.id as string,
        courseId: r.courseId as string,
        scheduledAt: r.scheduledAt as Date,
        durationMin: r.durationMin as number,
        topic: (r.topic as string | null) ?? null,
        status: r.status as string,
      }),
    } as unknown as ClassSession
  }

  async findByIdInInstitution(institutionId: string, id: string): Promise<ClassSession | null> {
    const r = this.rows.get(id)
    return r && r.institutionId === institutionId ? this.toEntity(r) : null
  }

  async findByCourseAndDate(
    institutionId: string,
    courseId: string,
    scheduledAt: Date,
  ): Promise<ClassSession | null> {
    const { dayStart, dayEnd } = this.dayWindow(scheduledAt)
    const r = Array.from(this.rows.values()).find(
      (row) =>
        row.institutionId === institutionId &&
        row.courseId === courseId &&
        (row.scheduledAt as Date) >= dayStart &&
        (row.scheduledAt as Date) < dayEnd,
    )
    return r ? this.toEntity(r) : null
  }

  async getOrCreateForCourseAndDate(input: {
    institutionId: string
    courseId: string
    scheduledAt: Date
    durationMin: number
    createdBy: string
    topic?: string | null
  }): Promise<ClassSession> {
    const existing = await this.findByCourseAndDate(
      input.institutionId,
      input.courseId,
      input.scheduledAt,
    )
    if (existing) return existing
    const id = `s-${this.next++}`
    const r = {
      id,
      institutionId: input.institutionId,
      courseId: input.courseId,
      scheduledAt: input.scheduledAt,
      durationMin: input.durationMin,
      topic: input.topic ?? null,
      status: 'SCHEDULED',
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.rows.set(id, r)
    this.onSessionCreated?.({
      id,
      institutionId: input.institutionId,
      courseId: input.courseId,
      scheduledAt: input.scheduledAt,
      status: 'SCHEDULED',
    })
    return this.toEntity(r)
  }

  async listInInstitution(institutionId: string) {
    const rows = Array.from(this.rows.values()).filter((r) => r.institutionId === institutionId)
    return { data: rows.map((r) => this.toEntity(r)) as never, nextCursor: null, hasMore: false }
  }

  async markCompleted(id: string): Promise<ClassSession> {
    const r = this.rows.get(id)
    if (!r) throw new NotFoundException({ message: 'Session not found' })
    r.status = 'COMPLETED'
    r.updatedAt = new Date()
    return this.toEntity(r)
  }

  async isTeacherAssignedToCourse(
    institutionId: string,
    teacherId: string,
    courseId: string,
  ): Promise<boolean> {
    return this.assignments.has(`${institutionId}:${courseId}:${teacherId}`)
  }

  async getCourseDefaultDuration(
    _institutionId: string,
    _courseId: string,
  ): Promise<number | null> {
    return 80 // hard-coded for tests
  }

  // Test fixture helpers
  setAssignment(institutionId: string, courseId: string, teacherId: string) {
    this.assignments.add(`${institutionId}:${courseId}:${teacherId}`)
  }

  private dayWindow(scheduledAt: Date): { dayStart: Date; dayEnd: Date } {
    const dayStart = new Date(scheduledAt)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    return { dayStart, dayEnd }
  }
}

// ─── Stub Cloudinary ──────────────────────────────────────────────────────

const stubCloudinary = (): jest.Mocked<Pick<CloudinaryService, 'uploadImage'>> => ({
  uploadImage: jest.fn().mockResolvedValue({
    url: `https://cdn.cloudinary.com/test/attendance/inst-A/att-1/evidence`,
    publicId: 'test/attendance/inst-A/att-1/evidence',
    width: 800,
    height: 600,
    format: 'jpg',
  }),
})

// ─── Test suite ───────────────────────────────────────────────────────────

describe('Attendance flow (integration)', () => {
  const TZ = 'America/Argentina/Buenos_Aires'
  const INST_A = 'inst-A'
  const INST_B = 'inst-B'
  const TEACHER_A = 't-A'
  const TEACHER_B = 't-B'
  const ADMIN_A = 'a-A'
  const COURSE_A = 'c-A'
  const COURSE_B = 'c-B'

  let attendance: InMemoryAttendanceRepo
  let sessions: InMemoryClassSessionRepo
  let mark: MarkAttendanceUseCase
  let modify: ModifyAttendanceUseCase
  let list: ListAttendanceUseCase
  let summary: AttendanceSummaryUseCase
  let get: GetAttendanceUseCase
  let uploadEvidence: UploadEvidenceUseCase
  let cloudinary: jest.Mocked<Pick<CloudinaryService, 'uploadImage'>>

  const todayISO = DateTime.now().setZone(TZ).toISODate() as string

  beforeEach(() => {
    attendance = new InMemoryAttendanceRepo()
    sessions = new InMemoryClassSessionRepo()
    sessions.onSessionCreated = (s) => attendance.registerSession(s)
    cloudinary = stubCloudinary()

    // Wire up data for institution A: 1 course, 5 students, teacher assigned.
    sessions.setAssignment(INST_A, COURSE_A, TEACHER_A)
    for (let i = 1; i <= 5; i++) {
      attendance.setEnrollment(COURSE_A, `stu-A${i}`, INST_A)
    }
    // Wire up institution B for cross-tenant tests.
    sessions.setAssignment(INST_B, COURSE_B, TEACHER_B)
    for (let i = 1; i <= 3; i++) {
      attendance.setEnrollment(COURSE_B, `stu-B${i}`, INST_B)
    }

    mark = new MarkAttendanceUseCase(attendance, sessions)
    modify = new ModifyAttendanceUseCase(attendance, sessions)
    list = new ListAttendanceUseCase(attendance)
    summary = new AttendanceSummaryUseCase(attendance)
    get = new GetAttendanceUseCase(attendance, sessions)
    uploadEvidence = new UploadEvidenceUseCase(attendance, cloudinary as never)
  })

  // ─── 1. Full mark flow ──────────────────────────────────────────────
  it('full mark flow: teacher marks 5 students, verifies counts and summary', async () => {
    enterTenantContext({ tenantId: INST_A, subdomain: 'u-a', timezone: TZ })
    const result = await mark.execute(
      {
        courseId: COURSE_A,
        date: todayISO,
        records: [
          { studentId: 'stu-A1', status: 'PRESENT' },
          { studentId: 'stu-A2', status: 'PRESENT' },
          { studentId: 'stu-A3', status: 'ABSENT' },
          { studentId: 'stu-A4', status: 'LATE', justificationText: '10 min tarde' },
          { studentId: 'stu-A5', status: 'JUSTIFIED' },
        ],
      },
      { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
    )
    expect(result).toMatchObject({
      created: 5,
      updated: 0,
      presentCount: 2,
      absentCount: 1,
      lateCount: 1,
      justifiedCount: 1,
    })
    expect(result.sessionId).toBeTruthy()

    // Verify the summary
    const s = await summary.executeCourse(INST_A, COURSE_A)
    expect(s).toMatchObject({ present: 2, absent: 1, late: 1, justified: 1, total: 5 })
    expect(s.percentages.present).toBe(40)
  })

  // ─── 2. Same-day rule for teacher ───────────────────────────────────
  it("teacher cannot modify yesterday's attendance (same-day rule)", async () => {
    enterTenantContext({ tenantId: INST_A, subdomain: 'u-a', timezone: TZ })

    // First, mark today's session.
    const r1 = await mark.execute(
      {
        courseId: COURSE_A,
        date: todayISO,
        records: [{ studentId: 'stu-A1', status: 'PRESENT' }],
      },
      { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
    )
    expect(r1.sessionId).toBeTruthy()

    // Get the session id from the bulk result, then re-mutate the
    // session date to yesterday so the modify use case's same-day
    // check fires.
    // (In real life, the teacher could only have marked TODAY, so
    // this simulates a "trying to modify a past session".)
    const att = (await list.execute({ sessionId: r1.sessionId }, INST_A)).data[0]!
    // Manually move the session's date to yesterday (for the test only)
    // by reaching into the in-memory sessions store.
    // Easier: rewrite the use case's day check by directly mutating
    // the session store. We expose it via a test helper.
    const sessionRow = (
      sessions as unknown as { rows: Map<string, { scheduledAt: Date }> }
    ).rows.get(r1.sessionId)!
    sessionRow.scheduledAt = DateTime.now().setZone(TZ).minus({ days: 1 }).startOf('day').toJSDate()

    // Now try to modify the attendance record from yesterday.
    await expect(
      modify.execute(
        att.id,
        { status: 'ABSENT' },
        { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  // ─── 3. Admin override of past date ─────────────────────────────────
  it("admin CAN modify yesterday's attendance (admin bypass)", async () => {
    enterTenantContext({ tenantId: INST_A, subdomain: 'u-a', timezone: TZ })

    // Mark today as a teacher.
    const r1 = await mark.execute(
      {
        courseId: COURSE_A,
        date: todayISO,
        records: [{ studentId: 'stu-A1', status: 'PRESENT' }],
      },
      { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
    )
    const att = (await list.execute({ sessionId: r1.sessionId }, INST_A)).data[0]!

    // Move the session to yesterday.
    const sessionRow = (
      sessions as unknown as { rows: Map<string, { scheduledAt: Date }> }
    ).rows.get(r1.sessionId)!
    sessionRow.scheduledAt = DateTime.now().setZone(TZ).minus({ days: 1 }).startOf('day').toJSDate()

    // Admin can modify.
    const updated = await modify.execute(
      att.id,
      { status: 'JUSTIFIED', justificationText: 'Certificado retroactivo' },
      { institutionId: INST_A, actorUserId: ADMIN_A, actorRole: 'INSTITUTION_ADMIN' },
    )
    expect(updated.status).toBe('JUSTIFIED')
  })

  // ─── 4. Cross-tenant isolation ─────────────────────────────────────
  it('teacher from institution A cannot access institution B records', async () => {
    enterTenantContext({ tenantId: INST_A, subdomain: 'u-a', timezone: TZ })

    // Mark as teacher in A.
    const r1 = await mark.execute(
      {
        courseId: COURSE_A,
        date: todayISO,
        records: [{ studentId: 'stu-A1', status: 'PRESENT' }],
      },
      { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
    )
    const attA = (await list.execute({ sessionId: r1.sessionId }, INST_A)).data[0]!

    // Try to get it from institution B's tenant context.
    enterTenantContext({ tenantId: INST_B, subdomain: 'u-b', timezone: TZ })
    await expect(
      get.execute(attA.id, {
        institutionId: INST_B,
        actorUserId: TEACHER_B,
        actorRole: 'TEACHER',
      }),
    ).rejects.toBeInstanceOf(NotFoundException)

    // Try to modify it.
    await expect(
      modify.execute(
        attA.id,
        { status: 'ABSENT' },
        { institutionId: INST_B, actorUserId: TEACHER_B, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  // ─── 5. Evidence upload (with stubbed Cloudinary) ──────────────────
  it('uploads evidence and stores the URL on the attendance record', async () => {
    enterTenantContext({ tenantId: INST_A, subdomain: 'u-a', timezone: TZ })
    const r1 = await mark.execute(
      {
        courseId: COURSE_A,
        date: todayISO,
        records: [{ studentId: 'stu-A1', status: 'ABSENT' }],
      },
      { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
    )
    const att = (await list.execute({ sessionId: r1.sessionId }, INST_A)).data[0]!

    const updated = await uploadEvidence.execute(att.id, INST_A, {
      buffer: Buffer.from('fake-image-bytes'),
      mimetype: 'image/jpeg',
      size: 1024,
    })

    expect(updated.evidenceUrl).toBe(
      `https://cdn.cloudinary.com/test/attendance/inst-A/att-1/evidence`,
    )
    expect(cloudinary.uploadImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        folder: `attendance/${INST_A}/${att.id}`,
        publicId: 'evidence',
      }),
    )
  })

  // ─── 6. Evidence rejected when file too big ────────────────────────
  it('rejects oversize evidence (5MB cap)', async () => {
    enterTenantContext({ tenantId: INST_A, subdomain: 'u-a', timezone: TZ })
    const r1 = await mark.execute(
      {
        courseId: COURSE_A,
        date: todayISO,
        records: [{ studentId: 'stu-A1', status: 'ABSENT' }],
      },
      { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
    )
    const att = (await list.execute({ sessionId: r1.sessionId }, INST_A)).data[0]!

    await expect(
      uploadEvidence.execute(att.id, INST_A, {
        buffer: Buffer.from('x'),
        mimetype: 'image/jpeg',
        size: 6 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  // ─── 7. Bulk idempotency ──────────────────────────────────────────
  it('marking twice updates existing records (no duplicates)', async () => {
    enterTenantContext({ tenantId: INST_A, subdomain: 'u-a', timezone: TZ })

    // First mark — all present.
    const r1 = await mark.execute(
      {
        courseId: COURSE_A,
        date: todayISO,
        records: [
          { studentId: 'stu-A1', status: 'PRESENT' },
          { studentId: 'stu-A2', status: 'PRESENT' },
        ],
      },
      { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
    )
    expect(r1.created).toBe(2)
    expect(r1.updated).toBe(0)

    // Second mark — change one to ABSENT.
    const r2 = await mark.execute(
      {
        courseId: COURSE_A,
        date: todayISO,
        records: [
          { studentId: 'stu-A1', status: 'ABSENT' },
          { studentId: 'stu-A2', status: 'PRESENT' },
        ],
      },
      { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
    )
    expect(r2.created).toBe(0)
    expect(r2.updated).toBe(2)

    // Total records for this session should still be 2.
    const records = await list.execute({ sessionId: r1.sessionId }, INST_A)
    expect(records.data).toHaveLength(2)
    const s = await summary.executeCourse(INST_A, COURSE_A)
    expect(s).toMatchObject({ present: 1, absent: 1, total: 2 })
  })

  // ─── 8. Non-enrolled student rejected (full rollback) ─────────────
  it('rejects a non-enrolled student, no records are created (atomic)', async () => {
    enterTenantContext({ tenantId: INST_A, subdomain: 'u-a', timezone: TZ })

    // 'stu-XXX' is not enrolled.
    await expect(
      mark.execute(
        {
          courseId: COURSE_A,
          date: todayISO,
          records: [
            { studentId: 'stu-A1', status: 'PRESENT' },
            { studentId: 'stu-XXX', status: 'PRESENT' },
          ],
        },
        { institutionId: INST_A, actorUserId: TEACHER_A, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)

    // No records were created (full rollback).
    const s = await summary.executeCourse(INST_A, COURSE_A)
    expect(s.total).toBe(0)
  })

  // ─── 9. Teacher-assigned check ─────────────────────────────────────
  it('teacher not assigned to course cannot mark', async () => {
    enterTenantContext({ tenantId: INST_A, subdomain: 'u-a', timezone: TZ })
    // TEACHER_B is not assigned to COURSE_A.
    await expect(
      mark.execute(
        {
          courseId: COURSE_A,
          date: todayISO,
          records: [{ studentId: 'stu-A1', status: 'PRESENT' }],
        },
        { institutionId: INST_A, actorUserId: TEACHER_B, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})

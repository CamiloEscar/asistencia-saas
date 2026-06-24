import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { DateTime } from 'luxon'
import { MarkAttendanceUseCase } from '../application/use-cases/mark-attendance.use-case'
import type { IAttendanceRepository } from '../domain/repositories/attendance.repository.interface'
import type { IClassSessionRepository } from '../domain/repositories/class-session.repository.interface'
import type { ClassSession } from '../domain/entities/class-session.entity'

/**
 * Unit tests for MarkAttendanceUseCase. Covers the spec's 13 REQs
 * for the mark flow:
 *  - happy path (teacher / admin)
 *  - same-day rule for teachers
 *  - teacher not assigned to course → 403
 *  - non-enrolled student → 400 (full rollback)
 *  - empty records → 400
 *  - future date → 400
 *  - default PRESENT when status omitted (REQ-ATT-001-06)
 *  - admin can mark any date
 */
describe('MarkAttendanceUseCase', () => {
  const TZ = 'America/Argentina/Buenos_Aires'
  const teacherId = 't-1'
  const adminId = 'a-1'
  const courseId = 'c-1'
  const sessionId = 's-1'

  let attendance: jest.Mocked<IAttendanceRepository>
  let classSessions: jest.Mocked<IClassSessionRepository>

  const todayISO = DateTime.now().setZone(TZ).toISODate() as string
  const todayDayStart = DateTime.now().setZone(TZ).startOf('day').toJSDate()

  const fakeSession: ClassSession = {
    id: sessionId,
    courseId,
    scheduledAt: todayDayStart,
    durationMin: 80,
    topic: null,
    status: 'SCHEDULED',
    createdBy: teacherId,
    createdAt: new Date(),
    updatedAt: new Date(),
    toPublicJson: () => ({
      id: sessionId,
      courseId,
      scheduledAt: todayDayStart,
      durationMin: 80,
      topic: null,
      status: 'SCHEDULED',
    }),
  } as unknown as ClassSession

  beforeEach(() => {
    attendance = {
      findById: jest.fn(),
      bulkCreateOrUpdate: jest.fn(),
      updateById: jest.fn(),
      list: jest.fn(),
      summaryByCourse: jest.fn(),
      summaryByStudent: jest.fn(),
      summaryByTeacher: jest.fn(),
      validateStudentsEnrolledInCourse: jest.fn(),
    } as unknown as jest.Mocked<IAttendanceRepository>

    classSessions = {
      findById: jest.fn(),
      findByCourseAndDate: jest.fn(),
      getOrCreateForCourseAndDate: jest.fn().mockResolvedValue(fakeSession),
      list: jest.fn(),
      markCompleted: jest.fn().mockResolvedValue(fakeSession),
      isTeacherAssignedToCourse: jest.fn().mockResolvedValue(true),
      getCourseDefaultDuration: jest.fn().mockResolvedValue(80),
    } as unknown as jest.Mocked<IClassSessionRepository>
  })

  it('teacher happy path: marks 3 students, all present, completes session', async () => {
    attendance.validateStudentsEnrolledInCourse.mockResolvedValue(undefined)
    attendance.bulkCreateOrUpdate.mockResolvedValue({
      created: 3,
      updated: 0,
      recordIds: ['r1', 'r2', 'r3'],
    })

    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    const result = await useCase.execute(
      {
        courseId,
        date: todayISO,
        records: [{ studentId: 'stu-1' }, { studentId: 'stu-2' }, { studentId: 'stu-3' }],
      },
      { actorUserId: teacherId, actorRole: 'TEACHER' },
    )

    expect(result).toMatchObject({
      sessionId,
      created: 3,
      updated: 0,
      presentCount: 3,
      absentCount: 0,
      lateCount: 0,
      justifiedCount: 0,
    })
    expect(attendance.bulkCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        recordedBy: teacherId,
      }),
    )
    expect(classSessions.markCompleted).toHaveBeenCalledWith(sessionId)
  })

  it('defaults status to PRESENT when omitted (REQ-ATT-001-06)', async () => {
    attendance.validateStudentsEnrolledInCourse.mockResolvedValue(undefined)
    attendance.bulkCreateOrUpdate.mockImplementation(async (input) => {
      // All records should carry status=PRESENT.
      for (const r of input.records) {
        expect(r.status).toBe('PRESENT')
      }
      return { created: 1, updated: 0, recordIds: ['r1'] }
    })

    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    await useCase.execute(
      {
        courseId,
        date: todayISO,
        records: [{ studentId: 'stu-1' }], // no status
      },
      { actorUserId: teacherId, actorRole: 'TEACHER' },
    )
    expect(attendance.bulkCreateOrUpdate).toHaveBeenCalled()
  })

  it('rejects a future date (400)', async () => {
    const future = DateTime.now().setZone(TZ).plus({ days: 1 }).toISODate() as string
    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        { courseId, date: future, records: [{ studentId: 'stu-1' }] },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('teacher cannot mark for yesterday (same-day rule, 403)', async () => {
    const yesterday = DateTime.now().setZone(TZ).minus({ days: 1 }).toISODate() as string
    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        { courseId, date: yesterday, records: [{ studentId: 'stu-1' }] },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('admin CAN mark for yesterday (admin bypass)', async () => {
    const yesterday = DateTime.now().setZone(TZ).minus({ days: 1 }).toISODate() as string
    attendance.validateStudentsEnrolledInCourse.mockResolvedValue(undefined)
    attendance.bulkCreateOrUpdate.mockResolvedValue({ created: 1, updated: 0, recordIds: ['r1'] })

    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    const result = await useCase.execute(
      { courseId, date: yesterday, records: [{ studentId: 'stu-1' }] },
      { actorUserId: adminId, actorRole: 'ADMIN' },
    )
    expect(result.created).toBe(1)
  })

  it('teacher not assigned to course → 403 (REQ-ATT-001-03)', async () => {
    classSessions.isTeacherAssignedToCourse.mockResolvedValue(false)
    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        { courseId, date: todayISO, records: [{ studentId: 'stu-1' }] },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('rejects non-enrolled students with 400 + full rollback (REQ-ATT-001-04)', async () => {
    attendance.validateStudentsEnrolledInCourse.mockRejectedValue(
      new BadRequestException({
        message: 'Student(s) not enrolled in this course: stu-1',
      }),
    )

    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        { courseId, date: todayISO, records: [{ studentId: 'stu-1' }] },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
    // The bulk upsert must NOT have been called — full rollback.
    expect(attendance.bulkCreateOrUpdate).not.toHaveBeenCalled()
  })

  it('rejects empty records (REQ-ATT-001-05)', async () => {
    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        { courseId, date: todayISO, records: [] },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects invalid date format', async () => {
    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        { courseId, date: 'not-a-date', records: [{ studentId: 'stu-1' }] },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('counts statuses correctly across mixed records', async () => {
    attendance.validateStudentsEnrolledInCourse.mockResolvedValue(undefined)
    attendance.bulkCreateOrUpdate.mockResolvedValue({
      created: 4,
      updated: 0,
      recordIds: ['r1', 'r2', 'r3', 'r4'],
    })

    const useCase = new MarkAttendanceUseCase(attendance, classSessions)
    const result = await useCase.execute(
      {
        courseId,
        date: todayISO,
        records: [
          { studentId: 's1', status: 'PRESENT' },
          { studentId: 's2', status: 'ABSENT', justificationText: 'enfermedad' },
          { studentId: 's3', status: 'LATE' },
          { studentId: 's4', status: 'JUSTIFIED' },
        ],
      },
      { actorUserId: teacherId, actorRole: 'TEACHER' },
    )
    expect(result).toMatchObject({
      presentCount: 1,
      absentCount: 1,
      lateCount: 1,
      justifiedCount: 1,
    })
  })
})

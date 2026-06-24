import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { DateTime } from 'luxon'
import { ModifyAttendanceUseCase } from '../application/use-cases/modify-attendance.use-case'
import type { IAttendanceRepository } from '../domain/repositories/attendance.repository.interface'
import type { IClassSessionRepository } from '../domain/repositories/class-session.repository.interface'
import type { ClassSession } from '../domain/entities/class-session.entity'
import type { Attendance } from '../domain/entities/attendance.entity'

/**
 * Unit tests for ModifyAttendanceUseCase (REQ-ATT-002).
 *  - same-day rule for teachers
 *  - admin can modify any date
 *  - 404 for non-existent records
 *  - teacher not assigned to course → 403
 *  - update with partial fields
 */
describe('ModifyAttendanceUseCase', () => {
  const TZ = 'America/Argentina/Buenos_Aires'
  const teacherId = 't-1'
  const adminId = 'a-1'
  const attendanceId = 'att-1'
  const sessionId = 's-1'
  const courseId = 'c-1'

  const today = DateTime.now().setZone(TZ)
  const todayStart = today.startOf('day').toJSDate()
  const yesterdayStart = today.minus({ days: 1 }).startOf('day').toJSDate()

  let attendance: jest.Mocked<IAttendanceRepository>
  let classSessions: jest.Mocked<IClassSessionRepository>

  const makeAttendance = (): Attendance =>
    ({
      id: attendanceId,
      sessionId,
      studentId: 'stu-1',
      status: 'PRESENT',
      recordedBy: teacherId,
      recordedAt: new Date(),
      updatedAt: new Date(),
      evidenceUrl: null,
      toPublicJson: () => ({}),
    }) as unknown as Attendance

  const makeSession = (scheduledAt: Date): ClassSession =>
    ({
      id: sessionId,
      courseId,
      scheduledAt,
      durationMin: 80,
      topic: null,
      status: 'COMPLETED',
      createdBy: teacherId,
      createdAt: new Date(),
      updatedAt: new Date(),
      toPublicJson: () => ({}),
    }) as unknown as ClassSession

  beforeEach(() => {
    attendance = {
      findById: jest.fn().mockResolvedValue(makeAttendance()),
      updateById: jest.fn().mockImplementation(async (_id, input) => ({
        ...makeAttendance(),
        status: input.status ?? 'PRESENT',
      })),
      bulkCreateOrUpdate: jest.fn(),
      list: jest.fn(),
      summaryByCourse: jest.fn(),
      summaryByStudent: jest.fn(),
      summaryByTeacher: jest.fn(),
      validateStudentsEnrolledInCourse: jest.fn(),
    } as unknown as jest.Mocked<IAttendanceRepository>

    classSessions = {
      findById: jest.fn().mockResolvedValue(makeSession(todayStart)),
      findByCourseAndDate: jest.fn(),
      getOrCreateForCourseAndDate: jest.fn(),
      list: jest.fn(),
      markCompleted: jest.fn(),
      isTeacherAssignedToCourse: jest.fn().mockResolvedValue(true),
      getCourseDefaultDuration: jest.fn(),
    } as unknown as jest.Mocked<IClassSessionRepository>
  })

  it("teacher modifies today's attendance (happy path, SCE-ATT-002-01)", async () => {
    classSessions.findById.mockResolvedValue(makeSession(todayStart))
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    const result = await useCase.execute(
      attendanceId,
      { status: 'LATE', justificationText: 'Llegó 10 min tarde' },
      { actorUserId: teacherId, actorRole: 'TEACHER' },
    )
    expect(result.status).toBe('LATE')
    expect(attendance.updateById).toHaveBeenCalledWith(
      attendanceId,
      expect.objectContaining({ status: 'LATE' }),
      teacherId,
    )
  })

  it("teacher cannot modify yesterday's attendance (SCE-ATT-002-02)", async () => {
    classSessions.findById.mockResolvedValue(makeSession(yesterdayStart))
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        attendanceId,
        { status: 'ABSENT' },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(attendance.updateById).not.toHaveBeenCalled()
  })

  it("admin can modify yesterday's attendance (SCE-ATT-002-03)", async () => {
    classSessions.findById.mockResolvedValue(makeSession(yesterdayStart))
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    const result = await useCase.execute(
      attendanceId,
      { status: 'JUSTIFIED', justificationText: 'Certificado' },
      { actorUserId: adminId, actorRole: 'ADMIN' },
    )
    expect(result.status).toBe('JUSTIFIED')
  })

  it('returns 404 when the record does not exist', async () => {
    attendance.findById.mockResolvedValue(null)
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        'att-missing',
        { status: 'ABSENT' },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('returns 404 when the session is missing (data integrity)', async () => {
    classSessions.findById.mockResolvedValue(null)
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        attendanceId,
        { status: 'ABSENT' },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('teacher not assigned to course → 403', async () => {
    classSessions.findById.mockResolvedValue(makeSession(todayStart))
    classSessions.isTeacherAssignedToCourse.mockResolvedValue(false)
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        attendanceId,
        { status: 'ABSENT' },
        { actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('partial update — only justificationText', async () => {
    classSessions.findById.mockResolvedValue(makeSession(todayStart))
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await useCase.execute(
      attendanceId,
      { justificationText: 'updated text' },
      { actorUserId: teacherId, actorRole: 'TEACHER' },
    )
    expect(attendance.updateById).toHaveBeenCalledWith(
      attendanceId,
      { justificationText: 'updated text' },
      teacherId,
    )
  })

  it('rejects STUDENT role', async () => {
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        attendanceId,
        { status: 'ABSENT' },
        { actorUserId: 'stu-1', actorRole: 'STUDENT' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})

import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { DateTime } from 'luxon'
import { ModifyAttendanceUseCase } from '../application/use-cases/modify-attendance.use-case'
import { enterTenantContext } from '../../../shared/tenant/tenant.context'
import type { IAttendanceRepository } from '../domain/repositories/attendance.repository.interface'
import type { IClassSessionRepository } from '../domain/repositories/class-session.repository.interface'
import type { ClassSession } from '../domain/entities/class-session.entity'
import type { Attendance } from '../domain/entities/attendance.entity'

/**
 * Unit tests for ModifyAttendanceUseCase (REQ-ATT-002).
 *  - same-day rule for teachers
 *  - admin can modify any date
 *  - 404 for cross-tenant or non-existent records
 *  - teacher not assigned to course → 403
 *  - update with partial fields
 */
describe('ModifyAttendanceUseCase', () => {
  const TZ = 'America/Argentina/Buenos_Aires'
  const institutionId = 'i-1'
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
      institutionId,
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
      institutionId,
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
      findByIdInInstitution: jest.fn().mockResolvedValue(makeAttendance()),
      updateByIdInInstitution: jest.fn().mockImplementation(async (_i, _id, input) => ({
        ...makeAttendance(),
        status: input.status ?? 'PRESENT',
      })),
      bulkCreateOrUpdate: jest.fn(),
      listInInstitution: jest.fn(),
      summaryByCourse: jest.fn(),
      summaryByStudent: jest.fn(),
      summaryByTeacher: jest.fn(),
      validateStudentsEnrolledInCourse: jest.fn(),
    } as unknown as jest.Mocked<IAttendanceRepository>

    classSessions = {
      findByIdInInstitution: jest.fn().mockResolvedValue(makeSession(todayStart)),
      findByCourseAndDate: jest.fn(),
      getOrCreateForCourseAndDate: jest.fn(),
      listInInstitution: jest.fn(),
      markCompleted: jest.fn(),
      isTeacherAssignedToCourse: jest.fn().mockResolvedValue(true),
      getCourseDefaultDuration: jest.fn(),
    } as unknown as jest.Mocked<IClassSessionRepository>

    enterTenantContext({ tenantId: institutionId, subdomain: 'u-a', timezone: TZ })
  })

  it("teacher modifies today's attendance (happy path, SCE-ATT-002-01)", async () => {
    classSessions.findByIdInInstitution.mockResolvedValue(makeSession(todayStart))
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    const result = await useCase.execute(
      attendanceId,
      { status: 'LATE', justificationText: 'Llegó 10 min tarde' },
      { institutionId, actorUserId: teacherId, actorRole: 'TEACHER' },
    )
    expect(result.status).toBe('LATE')
    expect(attendance.updateByIdInInstitution).toHaveBeenCalledWith(
      institutionId,
      attendanceId,
      expect.objectContaining({ status: 'LATE' }),
      teacherId,
    )
  })

  it("teacher cannot modify yesterday's attendance (SCE-ATT-002-02)", async () => {
    classSessions.findByIdInInstitution.mockResolvedValue(makeSession(yesterdayStart))
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        attendanceId,
        { status: 'ABSENT' },
        { institutionId, actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(attendance.updateByIdInInstitution).not.toHaveBeenCalled()
  })

  it("admin can modify yesterday's attendance (SCE-ATT-002-03)", async () => {
    classSessions.findByIdInInstitution.mockResolvedValue(makeSession(yesterdayStart))
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    const result = await useCase.execute(
      attendanceId,
      { status: 'JUSTIFIED', justificationText: 'Certificado' },
      { institutionId, actorUserId: adminId, actorRole: 'INSTITUTION_ADMIN' },
    )
    expect(result.status).toBe('JUSTIFIED')
  })

  it('returns 404 when the record does not exist (REQ-ATT cross-tenant)', async () => {
    attendance.findByIdInInstitution.mockResolvedValue(null)
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        'att-missing',
        { status: 'ABSENT' },
        { institutionId, actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('returns 404 when the session is missing (data integrity)', async () => {
    classSessions.findByIdInInstitution.mockResolvedValue(null)
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        attendanceId,
        { status: 'ABSENT' },
        { institutionId, actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('teacher not assigned to course → 403', async () => {
    classSessions.findByIdInInstitution.mockResolvedValue(makeSession(todayStart))
    classSessions.isTeacherAssignedToCourse.mockResolvedValue(false)
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await expect(
      useCase.execute(
        attendanceId,
        { status: 'ABSENT' },
        { institutionId, actorUserId: teacherId, actorRole: 'TEACHER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('partial update — only justificationText', async () => {
    classSessions.findByIdInInstitution.mockResolvedValue(makeSession(todayStart))
    const useCase = new ModifyAttendanceUseCase(attendance, classSessions)
    await useCase.execute(
      attendanceId,
      { justificationText: 'updated text' },
      { institutionId, actorUserId: teacherId, actorRole: 'TEACHER' },
    )
    expect(attendance.updateByIdInInstitution).toHaveBeenCalledWith(
      institutionId,
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
        { institutionId, actorUserId: 'stu-1', actorRole: 'STUDENT' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})

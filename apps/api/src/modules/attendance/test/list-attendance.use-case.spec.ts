import { ListAttendanceUseCase } from '../application/use-cases/list-attendance.use-case'
import { enterTenantContext } from '../../../shared/tenant/tenant.context'
import type { IAttendanceRepository } from '../domain/repositories/attendance.repository.interface'
import type { Attendance } from '../domain/entities/attendance.entity'

/**
 * Unit tests for ListAttendanceUseCase.
 *  - applies role-based filter (TEACHER / STUDENT / ADMIN)
 *  - passes filters through to the repository
 *  - defaults limit + cursor
 */
describe('ListAttendanceUseCase', () => {
  const institutionId = 'i-1'
  let attendance: jest.Mocked<IAttendanceRepository>

  const fakeAttendance = (): Attendance =>
    ({
      id: 'att-1',
      institutionId,
      sessionId: 's-1',
      studentId: 'stu-1',
      status: 'PRESENT',
      recordedBy: 'u-1',
      recordedAt: new Date(),
      updatedAt: new Date(),
      evidenceUrl: null,
      toPublicJson: () => ({}),
    }) as unknown as Attendance

  beforeEach(() => {
    attendance = {
      findByIdInInstitution: jest.fn(),
      bulkCreateOrUpdate: jest.fn(),
      updateByIdInInstitution: jest.fn(),
      listInInstitution: jest.fn().mockResolvedValue({
        data: [fakeAttendance()],
        nextCursor: null,
        hasMore: false,
      }),
      summaryByCourse: jest.fn(),
      summaryByStudent: jest.fn(),
      summaryByTeacher: jest.fn(),
      validateStudentsEnrolledInCourse: jest.fn(),
    } as unknown as jest.Mocked<IAttendanceRepository>
  })

  it('applies ADMIN role + institutionId when no user context', async () => {
    enterTenantContext({ tenantId: institutionId, subdomain: 'u-a', timezone: 'UTC' })
    const useCase = new ListAttendanceUseCase(attendance)
    await useCase.execute({}, institutionId)
    expect(attendance.listInInstitution).toHaveBeenCalledWith(
      institutionId,
      expect.objectContaining({ forRole: 'ADMIN' }),
    )
  })

  it('applies TEACHER role + forUserId from tenant context', async () => {
    enterTenantContext({
      tenantId: institutionId,
      subdomain: 'u-a',
      timezone: 'UTC',
      userId: 't-1',
      role: 'TEACHER',
    })
    const useCase = new ListAttendanceUseCase(attendance)
    await useCase.execute({}, institutionId)
    expect(attendance.listInInstitution).toHaveBeenCalledWith(
      institutionId,
      expect.objectContaining({ forRole: 'TEACHER', forUserId: 't-1' }),
    )
  })

  it('applies STUDENT role + forUserId from tenant context', async () => {
    enterTenantContext({
      tenantId: institutionId,
      subdomain: 'u-a',
      timezone: 'UTC',
      userId: 'stu-1',
      role: 'STUDENT',
    })
    const useCase = new ListAttendanceUseCase(attendance)
    await useCase.execute({ courseId: 'c-1' }, institutionId)
    expect(attendance.listInInstitution).toHaveBeenCalledWith(
      institutionId,
      expect.objectContaining({
        forRole: 'STUDENT',
        forUserId: 'stu-1',
        courseId: 'c-1',
      }),
    )
  })

  it('passes filters through to the repository', async () => {
    enterTenantContext({ tenantId: institutionId, subdomain: 'u-a', timezone: 'UTC' })
    const useCase = new ListAttendanceUseCase(attendance)
    await useCase.execute(
      {
        cursor: 'abc',
        limit: 50,
        status: 'ABSENT',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
        studentId: 'stu-1',
        sessionId: 's-1',
      },
      institutionId,
    )
    const call = attendance.listInInstitution.mock.calls[0]!
    expect(call[0]).toBe(institutionId)
    expect(call[1].cursor).toBe('abc')
    expect(call[1].limit).toBe(50)
    expect(call[1].status).toBe('ABSENT')
    expect(call[1].studentId).toBe('stu-1')
    expect(call[1].sessionId).toBe('s-1')
    // Dates are coerced to Date objects
    expect(call[1].dateFrom).toBeInstanceOf(Date)
    expect(call[1].dateTo).toBeInstanceOf(Date)
  })

  it('returns the repository result unchanged', async () => {
    enterTenantContext({ tenantId: institutionId, subdomain: 'u-a', timezone: 'UTC' })
    const useCase = new ListAttendanceUseCase(attendance)
    const r = await useCase.execute({}, institutionId)
    expect(r.data).toHaveLength(1)
    expect(r.hasMore).toBe(false)
  })
})

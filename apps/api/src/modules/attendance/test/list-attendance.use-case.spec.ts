import { ListAttendanceUseCase } from '../application/use-cases/list-attendance.use-case'
import type { IAttendanceRepository } from '../domain/repositories/attendance.repository.interface'
import type { Attendance } from '../domain/entities/attendance.entity'

/**
 * Unit tests for ListAttendanceUseCase.
 *  - applies role-based filter (TEACHER / STUDENT / ADMIN)
 *  - passes filters through to the repository
 *  - defaults limit + cursor
 */
describe('ListAttendanceUseCase', () => {
  let attendance: jest.Mocked<IAttendanceRepository>

  const fakeAttendance = (): Attendance =>
    ({
      id: 'att-1',
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
      findById: jest.fn(),
      bulkCreateOrUpdate: jest.fn(),
      updateById: jest.fn(),
      list: jest.fn().mockResolvedValue({
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

  it('applies ADMIN role when no specific user context', async () => {
    const useCase = new ListAttendanceUseCase(attendance)
    await useCase.execute({}, { role: 'ADMIN', userId: 'a-1' })
    expect(attendance.list).toHaveBeenCalledWith(
      expect.objectContaining({ forRole: 'ADMIN' }),
    )
  })

  it('applies TEACHER role + forUserId', async () => {
    const useCase = new ListAttendanceUseCase(attendance)
    await useCase.execute({}, { role: 'TEACHER', userId: 't-1' })
    expect(attendance.list).toHaveBeenCalledWith(
      expect.objectContaining({ forRole: 'TEACHER', forUserId: 't-1' }),
    )
  })

  it('applies STUDENT role + forUserId', async () => {
    const useCase = new ListAttendanceUseCase(attendance)
    await useCase.execute(
      { courseId: 'c-1' },
      { role: 'STUDENT', userId: 'stu-1' },
    )
    expect(attendance.list).toHaveBeenCalledWith(
      expect.objectContaining({
        forRole: 'STUDENT',
        forUserId: 'stu-1',
        courseId: 'c-1',
      }),
    )
  })

  it('passes filters through to the repository', async () => {
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
      { role: 'ADMIN', userId: 'a-1' },
    )
    const call = attendance.list.mock.calls[0]!
    expect(call[0].cursor).toBe('abc')
    expect(call[0].limit).toBe(50)
    expect(call[0].status).toBe('ABSENT')
    expect(call[0].studentId).toBe('stu-1')
    expect(call[0].sessionId).toBe('s-1')
    // Dates are coerced to Date objects
    expect(call[0].dateFrom).toBeInstanceOf(Date)
    expect(call[0].dateTo).toBeInstanceOf(Date)
  })

  it('returns the repository result unchanged', async () => {
    const useCase = new ListAttendanceUseCase(attendance)
    const r = await useCase.execute({}, { role: 'ADMIN', userId: 'a-1' })
    expect(r.data).toHaveLength(1)
    expect(r.hasMore).toBe(false)
  })
})

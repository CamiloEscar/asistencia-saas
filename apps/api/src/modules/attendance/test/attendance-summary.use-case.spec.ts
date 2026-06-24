import { ForbiddenException } from '@nestjs/common'
import { AttendanceSummaryUseCase } from '../application/use-cases/attendance-summary.use-case'
import type { IAttendanceRepository } from '../domain/repositories/attendance.repository.interface'

/**
 * Unit tests for AttendanceSummaryUseCase.
 *  - courseId path → summaryByCourse
 *  - studentId path → summaryByStudent (with cross-student guard)
 *  - teacherId path → summaryByTeacher
 *  - empty query → empty summary
 */
describe('AttendanceSummaryUseCase', () => {
  let attendance: jest.Mocked<IAttendanceRepository>

  const fakeSummary = {
    present: 8,
    absent: 1,
    late: 0,
    justified: 1,
    total: 10,
    percentages: { present: 80, absent: 10, late: 0, justified: 10 },
  }

  beforeEach(() => {
    attendance = {
      findById: jest.fn(),
      bulkCreateOrUpdate: jest.fn(),
      updateById: jest.fn(),
      list: jest.fn(),
      summaryByCourse: jest.fn().mockResolvedValue(fakeSummary),
      summaryByStudent: jest.fn().mockResolvedValue(fakeSummary),
      summaryByTeacher: jest.fn().mockResolvedValue(fakeSummary),
      validateStudentsEnrolledInCourse: jest.fn(),
    } as unknown as jest.Mocked<IAttendanceRepository>
  })

  it('executeFromQuery with courseId calls summaryByCourse', async () => {
    const useCase = new AttendanceSummaryUseCase(attendance)
    const result = await useCase.executeFromQuery(
      { courseId: 'c-1' },
      { role: 'ADMIN', userId: 'a-1' },
    )
    expect(attendance.summaryByCourse).toHaveBeenCalledWith('c-1', undefined)
    expect(result).toEqual(fakeSummary)
  })

  it('executeFromQuery with studentId calls summaryByStudent', async () => {
    const useCase = new AttendanceSummaryUseCase(attendance)
    const result = await useCase.executeFromQuery(
      { studentId: 'stu-1' },
      { role: 'ADMIN', userId: 'a-1' },
    )
    expect(attendance.summaryByStudent).toHaveBeenCalledWith('stu-1', undefined, undefined)
    expect(result).toEqual(fakeSummary)
  })

  it('STUDENT can only see their own summary', async () => {
    const useCase = new AttendanceSummaryUseCase(attendance)
    await expect(
      useCase.executeFromQuery(
        { studentId: 'stu-other' },
        { role: 'STUDENT', userId: 'stu-me' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('STUDENT can see their own summary', async () => {
    const useCase = new AttendanceSummaryUseCase(attendance)
    await useCase.executeFromQuery(
      { studentId: 'stu-me' },
      { role: 'STUDENT', userId: 'stu-me' },
    )
    expect(attendance.summaryByStudent).toHaveBeenCalled()
  })

  it('executeFromQuery with teacherId calls summaryByTeacher', async () => {
    const useCase = new AttendanceSummaryUseCase(attendance)
    await useCase.executeFromQuery(
      { teacherId: 't-1' },
      { role: 'ADMIN', userId: 'a-1' },
    )
    expect(attendance.summaryByTeacher).toHaveBeenCalledWith('t-1', undefined)
  })

  it('passes date range through to the repository', async () => {
    const useCase = new AttendanceSummaryUseCase(attendance)
    await useCase.executeFromQuery(
      { courseId: 'c-1', dateFrom: '2026-06-01', dateTo: '2026-06-30' },
      { role: 'ADMIN', userId: 'a-1' },
    )
    expect(attendance.summaryByCourse).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({
        from: expect.any(Date),
        to: expect.any(Date),
      }),
    )
  })

  it('returns empty summary when no entity is given', async () => {
    const useCase = new AttendanceSummaryUseCase(attendance)
    const result = await useCase.executeFromQuery({}, { role: 'ADMIN', userId: 'a-1' })
    expect(result).toMatchObject({ total: 0, present: 0 })
  })
})

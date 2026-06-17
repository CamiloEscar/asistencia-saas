import { ForbiddenException } from '@nestjs/common'
import { AttendanceSummaryUseCase } from '../application/use-cases/attendance-summary.use-case'
import { enterTenantContext } from '../../../shared/tenant/tenant.context'
import type { IAttendanceRepository } from '../domain/repositories/attendance.repository.interface'

/**
 * Unit tests for AttendanceSummaryUseCase.
 *  - courseId path → summaryByCourse
 *  - studentId path → summaryByStudent (with cross-student guard)
 *  - teacherId path → summaryByTeacher
 *  - empty query → empty summary
 */
describe('AttendanceSummaryUseCase', () => {
  const institutionId = 'i-1'
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
      findByIdInInstitution: jest.fn(),
      bulkCreateOrUpdate: jest.fn(),
      updateByIdInInstitution: jest.fn(),
      listInInstitution: jest.fn(),
      summaryByCourse: jest.fn().mockResolvedValue(fakeSummary),
      summaryByStudent: jest.fn().mockResolvedValue(fakeSummary),
      summaryByTeacher: jest.fn().mockResolvedValue(fakeSummary),
      validateStudentsEnrolledInCourse: jest.fn(),
    } as unknown as jest.Mocked<IAttendanceRepository>
  })

  it('executeFromQuery with courseId calls summaryByCourse', async () => {
    enterTenantContext({ tenantId: institutionId, subdomain: 'u-a', timezone: 'UTC' })
    const useCase = new AttendanceSummaryUseCase(attendance)
    const result = await useCase.executeFromQuery({ courseId: 'c-1' }, institutionId)
    expect(attendance.summaryByCourse).toHaveBeenCalledWith(institutionId, 'c-1', undefined)
    expect(result).toEqual(fakeSummary)
  })

  it('executeFromQuery with studentId calls summaryByStudent', async () => {
    enterTenantContext({ tenantId: institutionId, subdomain: 'u-a', timezone: 'UTC' })
    const useCase = new AttendanceSummaryUseCase(attendance)
    const result = await useCase.executeFromQuery({ studentId: 'stu-1' }, institutionId)
    expect(attendance.summaryByStudent).toHaveBeenCalledWith(
      institutionId,
      'stu-1',
      undefined,
      undefined,
    )
    expect(result).toEqual(fakeSummary)
  })

  it('STUDENT can only see their own summary', async () => {
    enterTenantContext({
      tenantId: institutionId,
      subdomain: 'u-a',
      timezone: 'UTC',
      userId: 'stu-me',
      role: 'STUDENT',
    })
    const useCase = new AttendanceSummaryUseCase(attendance)
    await expect(
      useCase.executeFromQuery({ studentId: 'stu-other' }, institutionId),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('STUDENT can see their own summary', async () => {
    enterTenantContext({
      tenantId: institutionId,
      subdomain: 'u-a',
      timezone: 'UTC',
      userId: 'stu-me',
      role: 'STUDENT',
    })
    const useCase = new AttendanceSummaryUseCase(attendance)
    await useCase.executeFromQuery({ studentId: 'stu-me' }, institutionId)
    expect(attendance.summaryByStudent).toHaveBeenCalled()
  })

  it('executeFromQuery with teacherId calls summaryByTeacher', async () => {
    enterTenantContext({ tenantId: institutionId, subdomain: 'u-a', timezone: 'UTC' })
    const useCase = new AttendanceSummaryUseCase(attendance)
    await useCase.executeFromQuery({ teacherId: 't-1' }, institutionId)
    expect(attendance.summaryByTeacher).toHaveBeenCalledWith(institutionId, 't-1', undefined)
  })

  it('passes date range through to the repository', async () => {
    enterTenantContext({ tenantId: institutionId, subdomain: 'u-a', timezone: 'UTC' })
    const useCase = new AttendanceSummaryUseCase(attendance)
    await useCase.executeFromQuery(
      { courseId: 'c-1', dateFrom: '2026-06-01', dateTo: '2026-06-30' },
      institutionId,
    )
    expect(attendance.summaryByCourse).toHaveBeenCalledWith(
      institutionId,
      'c-1',
      expect.objectContaining({
        from: expect.any(Date),
        to: expect.any(Date),
      }),
    )
  })

  it('returns empty summary when no entity is given', async () => {
    enterTenantContext({ tenantId: institutionId, subdomain: 'u-a', timezone: 'UTC' })
    const useCase = new AttendanceSummaryUseCase(attendance)
    const result = await useCase.executeFromQuery({}, institutionId)
    expect(result).toMatchObject({ total: 0, present: 0 })
  })
})

import { ConflictException } from '@nestjs/common'
import { CreateCourseUseCase } from './create-course.use-case'
import { UnassignTeacherUseCase } from './unassign-teacher.use-case'
import { Course } from '../../domain/entities/course.entity'
import type { ICourseRepository } from '../../domain/repositories/course.repository.interface'

/**
 * Unit tests for course use cases. Covers:
 *   - create-course: cross-tenant rejection
 *   - unassign-teacher: last-teacher protection
 */
describe('Course use cases', () => {
  let courses: jest.Mocked<ICourseRepository>

  const validInput = {
    code: 'C-101',
    name: 'Course 101',
    semester: '2026-1',
    subjectId: 'subj-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-07-01'),
    schedule: { weekly: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:30' }] },
  } as never

  const baseEntity = Course.fromPersistence({
    id: 'c-1',
    institutionId: 'i-1',
    subjectId: 'subj-1',
    code: 'C-101',
    name: 'Course 101',
    description: null,
    semester: '2026-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-07-01'),
    schedule: { weekly: [] },
    defaultSessionDurationMin: 80,
  })

  beforeEach(() => {
    courses = {
      findByIdInInstitution: jest.fn(),
      findByCodeInInstitution: jest.fn(),
      listInInstitution: jest.fn(),
      createInInstitution: jest.fn(),
      updateInInstitution: jest.fn(),
      setDeletedInInstitution: jest.fn(),
      enrollStudent: jest.fn(),
      unenrollStudent: jest.fn(),
      listEnrolledStudents: jest.fn(),
      isStudentEnrolled: jest.fn(),
      assignTeacher: jest.fn(),
      unassignTeacher: jest.fn(),
      listAssignedTeachers: jest.fn(),
      countAssignedTeachers: jest.fn(),
      validateSubjectInInstitution: jest.fn(),
      validateTeacherInInstitution: jest.fn(),
      validateStudentInInstitution: jest.fn(),
    } as unknown as jest.Mocked<ICourseRepository>
  })

  describe('CreateCourseUseCase', () => {
    it('rejects when the subject is from another institution', async () => {
      courses.validateSubjectInInstitution.mockRejectedValue(
        new ConflictException({ message: 'Subject does not belong', error: 'Bad Request' }),
      )
      const useCase = new CreateCourseUseCase(courses)
      await expect(useCase.execute(validInput, 'i-1')).rejects.toBeInstanceOf(ConflictException)
    })

    it('creates a course when subject + teachers are valid', async () => {
      courses.validateSubjectInInstitution.mockResolvedValue(undefined)
      courses.findByCodeInInstitution.mockResolvedValue(null)
      courses.createInInstitution.mockResolvedValue(baseEntity)
      courses.assignTeacher.mockResolvedValue(undefined)
      courses.enrollStudent.mockResolvedValue(undefined)

      const useCase = new CreateCourseUseCase(courses)
      const result = await useCase.execute(
        Object.assign({}, validInput, { teacherIds: ['t-1'], initialStudentIds: ['s-1'] }),
        'i-1',
      )
      expect(result.course.code).toBe('C-101')
      expect(courses.assignTeacher).toHaveBeenCalledWith('c-1', 't-1')
      expect(courses.enrollStudent).toHaveBeenCalledWith('c-1', 's-1')
    })

    it('rejects a duplicate course code (409)', async () => {
      courses.validateSubjectInInstitution.mockResolvedValue(undefined)
      courses.findByCodeInInstitution.mockResolvedValue(baseEntity)

      const useCase = new CreateCourseUseCase(courses)
      await expect(useCase.execute(validInput, 'i-1')).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('UnassignTeacherUseCase', () => {
    it('rejects when it would leave the course without a teacher', async () => {
      courses.countAssignedTeachers.mockResolvedValue(1)
      const useCase = new UnassignTeacherUseCase(courses)
      await expect(useCase.execute('c-1', 't-1')).rejects.toBeInstanceOf(ConflictException)
    })

    it('unassigns when more than one teacher is assigned', async () => {
      courses.countAssignedTeachers.mockResolvedValue(2)
      courses.unassignTeacher.mockResolvedValue(undefined)

      const useCase = new UnassignTeacherUseCase(courses)
      const r = await useCase.execute('c-1', 't-1')
      expect(r.removed).toBe(true)
    })
  })
})

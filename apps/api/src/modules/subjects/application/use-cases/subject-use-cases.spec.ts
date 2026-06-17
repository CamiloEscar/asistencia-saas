import { ConflictException } from '@nestjs/common'
import { CreateSubjectUseCase } from './create-subject.use-case'
import { DeactivateSubjectUseCase } from './deactivate-subject.use-case'
import { Subject } from '../../domain/entities/subject.entity'
import type { ISubjectRepository } from '../../domain/repositories/subject.repository.interface'

/**
 * Unit tests for subject use cases. Covers:
 *   - create-subject: duplicate code within institution
 *   - deactivate-subject: protected when active courses exist
 */
describe('Subject use cases', () => {
  let subjects: jest.Mocked<ISubjectRepository>

  const baseEntity = Subject.fromPersistence({
    id: 's-1',
    institutionId: 'i-1',
    code: 'MAT101',
    name: 'Matemática I',
    description: null,
  })

  beforeEach(() => {
    subjects = {
      findByIdInInstitution: jest.fn(),
      findByCodeInInstitution: jest.fn(),
      listInInstitution: jest.fn(),
      createInInstitution: jest.fn(),
      updateInInstitution: jest.fn(),
      setDeletedInInstitution: jest.fn(),
      countActiveCoursesInInstitution: jest.fn(),
    } as unknown as jest.Mocked<ISubjectRepository>
  })

  describe('CreateSubjectUseCase', () => {
    it('creates a subject when the code is unique', async () => {
      subjects.findByCodeInInstitution.mockResolvedValue(null)
      subjects.createInInstitution.mockResolvedValue(baseEntity)

      const useCase = new CreateSubjectUseCase(subjects)
      const result = await useCase.execute({ code: 'mat101', name: 'Matemática I' }, 'i-1')
      expect(result.subject.code).toBe('MAT101')
      expect(subjects.createInInstitution).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'MAT101' }),
      )
    })

    it('rejects a duplicate code (409)', async () => {
      subjects.findByCodeInInstitution.mockResolvedValue(baseEntity)

      const useCase = new CreateSubjectUseCase(subjects)
      await expect(useCase.execute({ code: 'MAT101', name: 'X' }, 'i-1')).rejects.toBeInstanceOf(
        ConflictException,
      )
    })
  })

  describe('DeactivateSubjectUseCase', () => {
    it('rejects when active courses reference the subject', async () => {
      subjects.findByIdInInstitution.mockResolvedValue(baseEntity)
      subjects.countActiveCoursesInInstitution.mockResolvedValue(3)

      const useCase = new DeactivateSubjectUseCase(subjects)
      await expect(useCase.execute('i-1', 's-1')).rejects.toBeInstanceOf(ConflictException)
    })

    it('deactivates a subject with no active courses', async () => {
      subjects.findByIdInInstitution.mockResolvedValue(baseEntity)
      subjects.countActiveCoursesInInstitution.mockResolvedValue(0)
      subjects.setDeletedInInstitution.mockResolvedValue(baseEntity)

      const useCase = new DeactivateSubjectUseCase(subjects)
      await expect(useCase.execute('i-1', 's-1')).resolves.toBeDefined()
      expect(subjects.setDeletedInInstitution).toHaveBeenCalledWith('i-1', 's-1')
    })
  })
})

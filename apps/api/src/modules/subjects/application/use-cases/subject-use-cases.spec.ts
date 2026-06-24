import { ConflictException } from '@nestjs/common'
import { CreateSubjectUseCase } from './create-subject.use-case'
import { DeactivateSubjectUseCase } from './deactivate-subject.use-case'
import { Subject } from '../../domain/entities/subject.entity'
import type { ISubjectRepository } from '../../domain/repositories/subject.repository.interface'

/**
 * Unit tests for subject use cases. Covers:
 *   - create-subject: duplicate code rejection
 *   - deactivate-subject: protected when active courses exist
 */
describe('Subject use cases', () => {
  let subjects: jest.Mocked<ISubjectRepository>

  const baseEntity = Subject.fromPersistence({
    id: 's-1',
    code: 'MAT101',
    name: 'Matemática I',
    description: null,
  })

  beforeEach(() => {
    subjects = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setDeleted: jest.fn(),
      countActiveCourses: jest.fn(),
    } as unknown as jest.Mocked<ISubjectRepository>
  })

  describe('CreateSubjectUseCase', () => {
    it('creates a subject when the code is unique', async () => {
      subjects.findByCode.mockResolvedValue(null)
      subjects.create.mockResolvedValue(baseEntity)

      const useCase = new CreateSubjectUseCase(subjects)
      const result = await useCase.execute({ code: 'mat101', name: 'Matemática I' })
      expect(result.subject.code).toBe('MAT101')
      expect(subjects.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'MAT101' }),
      )
    })

    it('rejects a duplicate code (409)', async () => {
      subjects.findByCode.mockResolvedValue(baseEntity)

      const useCase = new CreateSubjectUseCase(subjects)
      await expect(
        useCase.execute({ code: 'MAT101', name: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('DeactivateSubjectUseCase', () => {
    it('rejects when active courses reference the subject', async () => {
      subjects.findById.mockResolvedValue(baseEntity)
      subjects.countActiveCourses.mockResolvedValue(3)

      const useCase = new DeactivateSubjectUseCase(subjects)
      await expect(useCase.execute('s-1')).rejects.toBeInstanceOf(ConflictException)
    })

    it('deactivates a subject with no active courses', async () => {
      subjects.findById.mockResolvedValue(baseEntity)
      subjects.countActiveCourses.mockResolvedValue(0)
      subjects.setDeleted.mockResolvedValue(baseEntity)

      const useCase = new DeactivateSubjectUseCase(subjects)
      await expect(useCase.execute('s-1')).resolves.toBeDefined()
      expect(subjects.setDeleted).toHaveBeenCalledWith('s-1')
    })
  })
})

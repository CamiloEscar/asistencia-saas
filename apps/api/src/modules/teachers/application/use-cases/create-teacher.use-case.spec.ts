import { ConflictException } from '@nestjs/common'
import type { PasswordHasherService } from '../../../../shared/crypto/password-hasher.service'
import type { SetPasswordUseCase } from '../../../auth/application/use-cases/set-password.use-case'
import type { Teacher } from '../../domain/entities/teacher.entity'
import type { ITeacherRepository } from '../../domain/repositories/teacher.repository.interface'
import { CreateTeacherUseCase } from './create-teacher.use-case'

describe('CreateTeacherUseCase', () => {
  let useCase: CreateTeacherUseCase
  let teachers: jest.Mocked<ITeacherRepository>
  let passwordHasher: jest.Mocked<PasswordHasherService>
  let setPassword: jest.Mocked<SetPasswordUseCase>

  beforeEach(() => {
    teachers = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
    } as unknown as jest.Mocked<ITeacherRepository>
    passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherService>
    setPassword = { issue: jest.fn() } as unknown as jest.Mocked<SetPasswordUseCase>
    useCase = new CreateTeacherUseCase(teachers, passwordHasher, setPassword)
  })

  it('creates a teacher (happy path)', async () => {
    teachers.findByEmail.mockResolvedValue(null)
    const created = {
      id: 't-1',
      email: 't@a.com',
      fullName: 'Teacher',
    } as unknown as Teacher
    teachers.create.mockResolvedValue(created)

    const result = await useCase.execute({
      email: 't@a.com',
      fullName: 'Teacher',
      sendActivationLink: false,
    } as never)

    expect(result.teacher.id).toBe('t-1')
    expect(result.temporaryPassword).toBeDefined()
    expect(teachers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 't@a.com' }),
    )
  })

  it('throws 409 on duplicate email', async () => {
    teachers.findByEmail.mockResolvedValue({ id: 'existing' } as unknown as Teacher)
    await expect(
      useCase.execute({
        email: 'dup@a.com',
        fullName: 'X',
        sendActivationLink: false,
      } as never),
    ).rejects.toBeInstanceOf(ConflictException)
  })
})

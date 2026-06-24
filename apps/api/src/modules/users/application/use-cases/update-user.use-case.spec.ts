import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import type { User } from '../../../auth/domain/entities/user.entity'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import { UpdateUserUseCase } from './update-user.use-case'

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase
  let users: jest.Mocked<IUserRepository>

  const baseUser = {
    id: 'u-1',
    email: 'a@x.com',
    fullName: 'A',
    role: 'ADMIN',
    status: 'ACTIVE',
  } as unknown as User

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setActive: jest.fn(),
      setPasswordHash: jest.fn(),
      countByRole: jest.fn(),
      toEntity: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>
    useCase = new UpdateUserUseCase(users)
  })

  it('updates a user (happy path)', async () => {
    users.findById.mockResolvedValue(baseUser)
    users.update.mockResolvedValue({ ...baseUser, fullName: 'New' } as unknown as User)

    const result = await useCase.execute('actor-1', 'u-1', { fullName: 'New' })
    expect(result.fullName).toBe('New')
  })

  it('throws 404 when target user is not found', async () => {
    users.findById.mockResolvedValue(null)
    await expect(
      useCase.execute('actor-1', 'u-1', { fullName: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('denies self role change (403)', async () => {
    users.findById.mockResolvedValue(baseUser)
    await expect(
      useCase.execute('u-1', 'u-1', { role: 'TEACHER' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('blocks demoting the last admin (409)', async () => {
    users.findById.mockResolvedValue(baseUser)
    users.countByRole.mockResolvedValue(1)
    await expect(
      useCase.execute('actor-2', 'u-1', { role: 'TEACHER' }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('rejects duplicate email (409)', async () => {
    users.findById.mockResolvedValue(baseUser)
    users.findByEmail.mockResolvedValue({
      id: 'other',
    } as unknown as User)
    await expect(
      useCase.execute('actor-1', 'u-1', { email: 'taken@x.com' }),
    ).rejects.toBeInstanceOf(ConflictException)
  })
})

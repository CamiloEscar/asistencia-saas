import { Student, type StudentExtras } from '../domain/entities/student.entity'

/**
 * Fixture helpers for student tests. The repository is mocked
 * in unit tests; these helpers build the Prisma-shaped rows the
 * mocks return.
 */
export const makeStudentRow = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: 'u-1',
  email: 'j@x.com',
  passwordHash: null,
  fullName: 'Juan Pérez',
  role: 'STUDENT',
  status: 'ACTIVE',
  legajo: '2024-001',
  phone: '555-0001',
  birthDate: new Date('2000-01-01'),
  career: 'Ing',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
})

export const makeStudent = (overrides: Partial<Record<string, unknown>> = {}): Student => {
  const row = makeStudentRow(overrides)
  const extras: StudentExtras = {
    legajo: (row.legajo as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    birthDate: (row.birthDate as Date | null) ?? null,
    career: (row.career as string | null) ?? null,
    createdAt: row.createdAt as Date | undefined,
    updatedAt: row.updatedAt as Date | undefined,
  }
  return Student.fromUser(
    {
      id: row.id as string,
      email: row.email as string,
      passwordHash: (row.passwordHash as string | null) ?? null,
      fullName: row.fullName as string,
      role: 'STUDENT',
      status: (row.status as 'ACTIVE' | 'INACTIVE') ?? 'ACTIVE',
    } as never,
    extras,
  )
}

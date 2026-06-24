/**
 * Idempotent seed script for asistencia-saas (single-tenant edition).
 *
 * Creates:
 *   - 1 AppConfig row (institution metadata)
 *   - 1 admin user, 3 teachers, 10 students
 *   - 1 subject, 1 course with all teachers + students assigned
 *   - 4 class sessions (2 past, 1 today, 1 future) with attendance records
 *
 * Run with: pnpm --filter @asistencia/api prisma:seed
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client'
import * as argon2 from 'argon2'

const prisma = new PrismaClient()

const DEFAULT_PASSWORD = 'Admin123!'
const ARGON_OPTS = { memoryCost: 65536, timeCost: 3, parallelism: 4 } as const

async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON_OPTS)
}

async function main(): Promise<void> {
  console.log('🌱 Seeding asistencia-saas (single-tenant)...')

  // ── 0. App config ───────────────────────────────────────────────────────
  const config = await prisma.appConfig.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { name: 'Celsius', timezone: 'America/Argentina/Buenos_Aires' },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Celsius',
      timezone: 'America/Argentina/Buenos_Aires',
    },
  })
  console.log(`  ✓ app config: ${config.name}`)

  // ── 1. Admin ────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@celsius.com' },
    update: {},
    create: {
      email: 'admin@celsius.com',
      passwordHash: await hashPassword(DEFAULT_PASSWORD),
      fullName: 'Admin Celsius',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  })
  console.log(`  ✓ admin: ${admin.email}`)

  // ── 2. Teachers (3) ─────────────────────────────────────────────────────
  const teachers = await Promise.all(
    [1, 2, 3].map(async (n) =>
      prisma.user.upsert({
        where: { email: `teacher${n}@celsius.com` },
        update: {},
        create: {
          email: `teacher${n}@celsius.com`,
          passwordHash: await hashPassword(DEFAULT_PASSWORD),
          fullName: `Docente ${n}`,
          role: UserRole.TEACHER,
          legajo: `T-${n.toString().padStart(4, '0')}`,
        },
      }),
    ),
  )

  // ── 3. Students (10) ────────────────────────────────────────────────────
  const students = await Promise.all(
    Array.from({ length: 10 }, async (_, i) => {
      const n = i + 1
      return prisma.user.upsert({
        where: { email: `student${n}@celsius.com` },
        update: {},
        create: {
          email: `student${n}@celsius.com`,
          passwordHash: await hashPassword(DEFAULT_PASSWORD),
          fullName: `Estudiante ${n}`,
          role: UserRole.STUDENT,
          legajo: `S-${n.toString().padStart(5, '0')}`,
          career: 'Ingeniería en Sistemas',
        },
      })
    }),
  )

  // ── 4. Subject ──────────────────────────────────────────────────────────
  const subject = await prisma.subject.upsert({
    where: { code: 'MAT101' },
    update: {},
    create: {
      code: 'MAT101',
      name: 'Matemática I',
      description: 'Matemática básica de primer año',
    },
  })

  // ── 5. Course ───────────────────────────────────────────────────────────
  const course = await prisma.course.upsert({
    where: { code: 'MAT101-2026-1C' },
    update: {},
    create: {
      subjectId: subject.id,
      code: 'MAT101-2026-1C',
      name: 'Matemática I — 2026 1er Cuatrimestre',
      description: 'Comisión regular',
      semester: '2026-1C',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-07-15'),
      schedule: [
        { day: 1, startTime: '09:00', endTime: '10:30' },
        { day: 3, startTime: '09:00', endTime: '10:30' },
      ],
      defaultSessionDurationMin: 80,
    },
  })

  // ── 6. Assign teacher 1 to course ───────────────────────────────────────
  await prisma.courseTeacher.upsert({
    where: { courseId_teacherId: { courseId: course.id, teacherId: teachers[0]!.id } },
    update: {},
    create: { courseId: course.id, teacherId: teachers[0]!.id },
  })

  // ── 7. Enroll all students ───────────────────────────────────────────────
  for (const student of students) {
    await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
      update: {},
      create: { courseId: course.id, studentId: student.id },
    })
  }

  // ── 8. Class sessions + attendance ──────────────────────────────────────
  const now = new Date()
  const sessionSpecs = [
    { scheduledAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), status: 'CLOSED' as const },
    { scheduledAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), status: 'CLOSED' as const },
    { scheduledAt: now, status: 'OPEN' as const },
    { scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), status: 'SCHEDULED' as const },
  ]

  for (const spec of sessionSpecs) {
    const session = await prisma.classSession.upsert({
      where: { courseId_scheduledAt: { courseId: course.id, scheduledAt: spec.scheduledAt } },
      update: { status: spec.status },
      create: {
        courseId: course.id,
        scheduledAt: spec.scheduledAt,
        durationMin: 80,
        status: spec.status,
        createdBy: admin.id,
        topic: `Sesión ${spec.status.toLowerCase()}`,
      },
    })

    if (spec.status === 'CLOSED') {
      for (const student of students) {
        await prisma.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
          update: {},
          create: {
            sessionId: session.id,
            studentId: student.id,
            status: 'PRESENT',
            recordedBy: teachers[0]!.id,
            recordedAt: spec.scheduledAt,
          },
        })
      }
    }
  }

  console.log(`    → 3 teachers, 10 students, 1 course, 4 sessions seeded`)
  console.log('\n✅ Seed complete.\n')
  console.log('Credentials (password: Admin123!):')
  console.log('  ADMIN   → admin@celsius.com')
  console.log('  TEACHER → teacher1@celsius.com')
  console.log('  STUDENT → student1@celsius.com')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error('Seed failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  })

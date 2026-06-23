/**
 * Idempotent seed script for asistencia-saas dev environment.
 *
 * Creates:
 *   - 1 system institution ("__system__") that holds the SUPER_ADMIN user.
 *     (Prisma does not support null in compound unique constraints, so the
 *     super admin must live in a real institution row that we hide behind a
 *     special slug. The application layer is responsible for treating users
 *     with role=SUPER_ADMIN as cross-tenant regardless of institutionId.)
 *   - 2 demo institutions: celsius      (America/Argentina/Buenos_Aires),
 *                          universidad-b (America/Mexico_City)
 *   - Per institution: 1 admin, 3 teachers, 10 students, 1 subject,
 *                       1 course with all teachers + students assigned,
 *                       4 class sessions (2 past, 1 today, 1 future)
 *
 * Run with: pnpm --filter @asistencia/api prisma:seed
 *
 * Uses `upsert` everywhere — safe to run multiple times.
 */
import { PrismaClient, InstitutionStatus, UserRole, UserStatus } from '@prisma/client'
import * as argon2 from 'argon2'

const prisma = new PrismaClient()

const DEFAULT_PASSWORD = 'Admin123!'
const ARGON_OPTS = { memoryCost: 65536, timeCost: 3, parallelism: 4 } as const
const SYSTEM_INSTITUTION_SLUG = '__system__'

async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON_OPTS)
}

async function main(): Promise<void> {
  console.log('🌱 Seeding asistencia-saas dev database...')

  // ── 0. System institution (holds the SUPER_ADMIN) ───────────────────────
  const systemInstitution = await prisma.institution.upsert({
    where: { subdomain: SYSTEM_INSTITUTION_SLUG },
    update: {},
    create: {
      name: 'System',
      subdomain: SYSTEM_INSTITUTION_SLUG,
      timezone: 'UTC',
      status: InstitutionStatus.ACTIVE,
      plan: 'ENTERPRISE',
    },
  })
  console.log(`  ✓ system institution (for super admin): ${systemInstitution.subdomain}`)

  // ── 1. Super admin (cross-tenant in app layer; lives in system institution) ─
  const superAdmin = await prisma.user.upsert({
    where: {
      institutionId_email: {
        institutionId: systemInstitution.id,
        email: 'super@asistencia-saas.com',
      },
    },
    update: {},
    create: {
      institutionId: systemInstitution.id,
      email: 'super@asistencia-saas.com',
      passwordHash: await hashPassword(DEFAULT_PASSWORD),
      fullName: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  })
  console.log(`  ✓ super admin: ${superAdmin.email}`)

  // ── 2. Demo institutions ────────────────────────────────────────────────
  const institutionsData = [
    { name: 'Celsius', subdomain: 'celsius', timezone: 'America/Argentina/Buenos_Aires' },
    { name: 'Universidad Demo B', subdomain: 'universidad-b', timezone: 'America/Mexico_City' },
  ]

  for (const data of institutionsData) {
    const institution = await prisma.institution.upsert({
      where: { subdomain: data.subdomain },
      update: { name: data.name, timezone: data.timezone },
      create: {
        name: data.name,
        subdomain: data.subdomain,
        timezone: data.timezone,
        status: 'ACTIVE',
        plan: 'FREE',
      },
    })
    console.log(`  ✓ institution: ${institution.subdomain} (${institution.id})`)

    // ── 3. Institution admin ──────────────────────────────────────────────
    const admin = await prisma.user.upsert({
      where: {
        institutionId_email: {
          institutionId: institution.id,
          email: `admin@${data.subdomain}.com`,
        },
      },
      update: {},
      create: {
        institutionId: institution.id,
        email: `admin@${data.subdomain}.com`,
        passwordHash: await hashPassword(DEFAULT_PASSWORD),
        fullName: `Admin ${data.subdomain}`,
        role: 'INSTITUTION_ADMIN',
      },
    })

    // ── 4. Teachers (3) ───────────────────────────────────────────────────
    const teachers = await Promise.all(
      [1, 2, 3].map(async (n) =>
        prisma.user.upsert({
          where: {
            institutionId_email: {
              institutionId: institution.id,
              email: `teacher${n}@${data.subdomain}.com`,
            },
          },
          update: {},
          create: {
            institutionId: institution.id,
            email: `teacher${n}@${data.subdomain}.com`,
            passwordHash: await hashPassword(DEFAULT_PASSWORD),
            fullName: `Teacher ${n} ${data.subdomain}`,
            role: 'TEACHER',
            legajo: `T-${n.toString().padStart(4, '0')}`,
          },
        }),
      ),
    )

    // ── 5. Students (10) ──────────────────────────────────────────────────
    const students = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const n = i + 1
        return prisma.user.upsert({
          where: {
            institutionId_email: {
              institutionId: institution.id,
              email: `student${n}@${data.subdomain}.com`,
            },
          },
          update: {},
          create: {
            institutionId: institution.id,
            email: `student${n}@${data.subdomain}.com`,
            passwordHash: await hashPassword(DEFAULT_PASSWORD),
            fullName: `Student ${n} ${data.subdomain}`,
            role: 'STUDENT',
            legajo: `S-${n.toString().padStart(5, '0')}`,
            career: data.subdomain === 'celsius' ? 'Ingeniería' : 'Administración',
          },
        })
      }),
    )

    // ── 6. Subject ────────────────────────────────────────────────────────
    const subject = await prisma.subject.upsert({
      where: { institutionId_code: { institutionId: institution.id, code: 'MAT101' } },
      update: {},
      create: {
        institutionId: institution.id,
        code: 'MAT101',
        name: 'Matemática I',
        description: 'Matemática básica de primer año',
      },
    })

    // ── 7. Course ─────────────────────────────────────────────────────────
    const course = await prisma.course.upsert({
      where: { institutionId_code: { institutionId: institution.id, code: 'MAT101-2026-1C' } },
      update: {},
      create: {
        institutionId: institution.id,
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

    // ── 8. Course teachers (assign teacher 1) ─────────────────────────────
    const teacherIds = [teachers[0]!.id]
    for (const teacherId of teacherIds) {
      await prisma.courseTeacher.upsert({
        where: { courseId_teacherId: { courseId: course.id, teacherId } },
        update: {},
        create: { institutionId: institution.id, courseId: course.id, teacherId },
      })
    }

    // ── 9. Enrollments (all 10 students) ─────────────────────────────────
    for (const student of students) {
      await prisma.enrollment.upsert({
        where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
        update: {},
        create: { institutionId: institution.id, courseId: course.id, studentId: student.id },
      })
    }

    // ── 10. Class sessions (2 past, 1 today, 1 future) ──────────────────
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const oneWeekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const sessionSpecs = [
      { scheduledAt: twoWeeksAgo, status: 'CLOSED' as const },
      { scheduledAt: oneWeekAgo, status: 'CLOSED' as const },
      { scheduledAt: now, status: 'OPEN' as const },
      { scheduledAt: oneWeekAhead, status: 'SCHEDULED' as const },
    ]
    for (const spec of sessionSpecs) {
      const session = await prisma.classSession.upsert({
        where: { courseId_scheduledAt: { courseId: course.id, scheduledAt: spec.scheduledAt } },
        update: { status: spec.status },
        create: {
          institutionId: institution.id,
          courseId: course.id,
          scheduledAt: spec.scheduledAt,
          durationMin: 80,
          status: spec.status,
          createdBy: admin.id,
          topic: `Sesión ${spec.status.toLowerCase()}`,
        },
      })

      // Attendance for past sessions: all PRESENT
      if (spec.status === 'CLOSED') {
        for (const student of students) {
          await prisma.attendanceRecord.upsert({
            where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
            update: {},
            create: {
              institutionId: institution.id,
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

    console.log(
      `    → ${teachers.length} teachers, ${students.length} students, 1 course, 4 sessions seeded`,
    )
  }

  console.log('\n✅ Seed complete.\n')
  console.log('Credentials (all use password: Admin123!):')
  console.log('  SUPER_ADMIN       → super@asistencia-saas.com')
  console.log('  celsius admin       → admin@celsius.com')
  console.log('  universidad-b admin → admin@universidad-b.com')
  console.log('  celsius t1          → teacher1@celsius.com')
  console.log('  celsius s1          → student1@celsius.com')
  console.log('')
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

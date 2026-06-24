import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../../shared/prisma/prisma.module'
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard'
import { CreateCourseUseCase } from './application/use-cases/create-course.use-case'
import { ListCoursesUseCase } from './application/use-cases/list-courses.use-case'
import { GetCourseUseCase } from './application/use-cases/get-course.use-case'
import { UpdateCourseUseCase } from './application/use-cases/update-course.use-case'
import { DeactivateCourseUseCase } from './application/use-cases/deactivate-course.use-case'
import { AssignTeachersUseCase } from './application/use-cases/assign-teachers.use-case'
import { EnrollStudentsUseCase } from './application/use-cases/enroll-students.use-case'
import { UnenrollStudentUseCase } from './application/use-cases/unenroll-student.use-case'
import { UnassignTeacherUseCase } from './application/use-cases/unassign-teacher.use-case'
import { ListEnrolledStudentsUseCase } from './application/use-cases/list-enrolled-students.use-case'
import { MyCoursesUseCase } from './application/use-cases/my-courses.use-case'
import { COURSE_REPOSITORY } from './domain/repositories/course.repository.interface'
import { PrismaCourseRepository } from './infrastructure/persistence/prisma-course.repository'
import { CoursesController } from './presentation/controllers/courses.controller'

/**
 * CoursesModule — course CRUD + teacher/student assignment +
 * enrollment management.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CoursesController],
  providers: [
    { provide: COURSE_REPOSITORY, useClass: PrismaCourseRepository },
    CreateCourseUseCase,
    ListCoursesUseCase,
    GetCourseUseCase,
    UpdateCourseUseCase,
    DeactivateCourseUseCase,
    AssignTeachersUseCase,
    EnrollStudentsUseCase,
    UnenrollStudentUseCase,
    UnassignTeacherUseCase,
    ListEnrolledStudentsUseCase,
    MyCoursesUseCase,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [COURSE_REPOSITORY, MyCoursesUseCase],
})
export class CoursesModule {}

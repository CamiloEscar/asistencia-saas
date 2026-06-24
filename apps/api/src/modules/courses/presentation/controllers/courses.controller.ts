import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { Audit } from '../../../../audit/decorators/audit.decorator'
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard'
import { Roles } from '../../../auth/presentation/decorators/roles.decorator'
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import  { CreateCourseUseCase } from '../../application/use-cases/create-course.use-case'
import  { ListCoursesUseCase } from '../../application/use-cases/list-courses.use-case'
import  { GetCourseUseCase } from '../../application/use-cases/get-course.use-case'
import  { UpdateCourseUseCase } from '../../application/use-cases/update-course.use-case'
import  { DeactivateCourseUseCase } from '../../application/use-cases/deactivate-course.use-case'
import  { AssignTeachersUseCase } from '../../application/use-cases/assign-teachers.use-case'
import  { EnrollStudentsUseCase } from '../../application/use-cases/enroll-students.use-case'
import  { UnenrollStudentUseCase } from '../../application/use-cases/unenroll-student.use-case'
import  { UnassignTeacherUseCase } from '../../application/use-cases/unassign-teacher.use-case'
import  { ListEnrolledStudentsUseCase } from '../../application/use-cases/list-enrolled-students.use-case'
import {
  CreateCourseDtoSchema,
  type CreateCourseDto,
  type CreateCourseResponse,
} from '../../application/dtos/create-course.dto'
import {
  UpdateCourseDtoSchema,
  type UpdateCourseDto,
} from '../../application/dtos/update-course.dto'
import {
  ListCoursesQueryDtoSchema,
  type ListCoursesQueryDto,
} from '../../application/dtos/list-courses.query.dto'
import {
  EnrollStudentsDtoSchema,
  type EnrollStudentsDto,
  AssignTeachersDtoSchema,
  type AssignTeachersDto,
} from '../../application/dtos/enroll-students.dto'

/**
 * CoursesController — `/api/courses/*` endpoints.
 *   - GET (list, by-id, by-id/students): any authenticated user.
 *     Filtering by role happens at the use case layer (TEACHER sees
 *     only their assigned courses, STUDENT only enrolled).
 *   - POST / PATCH / DELETE / enroll / unenroll / teachers:
 *     ADMIN only.
 */
@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(
    private readonly createUseCase: CreateCourseUseCase,
    private readonly listUseCase: ListCoursesUseCase,
    private readonly getUseCase: GetCourseUseCase,
    private readonly updateUseCase: UpdateCourseUseCase,
    private readonly deactivateUseCase: DeactivateCourseUseCase,
    private readonly assignTeachersUseCase: AssignTeachersUseCase,
    private readonly enrollStudentsUseCase: EnrollStudentsUseCase,
    private readonly unenrollStudentUseCase: UnenrollStudentUseCase,
    private readonly unassignTeacherUseCase: UnassignTeacherUseCase,
    private readonly listEnrolledStudentsUseCase: ListEnrolledStudentsUseCase,
  ) {}

  // ─── GET /courses ─────────────────────────────────────────────────────
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListCoursesQueryDtoSchema)) query: ListCoursesQueryDto,
  ): Promise<unknown> {
    const result = await this.listUseCase.execute({
      cursor: query.cursor,
      limit: query.limit,
      subjectId: query.subjectId ?? null,
      teacherId: query.teacherId ?? null,
      studentId: query.studentId ?? null,
      semester: query.semester ?? null,
      search: query.search ?? null,
      isActive: query.isActive ?? null,
    })
    return {
      data: result.data.map((c) => c.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── POST /courses ────────────────────────────────────────────────────
  @Post()
  @Roles('ADMIN')
  @Audit({ action: 'COURSE_CREATED', entityType: 'Course', entityIdFrom: 'result' })
  async create(
    @Body(new ZodValidationPipe(CreateCourseDtoSchema)) body: CreateCourseDto,
  ): Promise<CreateCourseResponse> {
    return this.createUseCase.execute(body)
  }

  // ─── GET /courses/:id ─────────────────────────────────────────────────
  @Get(':id')
  async byId(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const c = await this.getUseCase.execute(id)
    return c.toPublicJson()
  }

  // ─── PATCH /courses/:id ───────────────────────────────────────────────
  @Patch(':id')
  @Roles('ADMIN')
  @Audit({ action: 'COURSE_UPDATED', entityType: 'Course' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateCourseDtoSchema)) body: UpdateCourseDto,
  ): Promise<unknown> {
    const c = await this.updateUseCase.execute(id, body)
    return c.toPublicJson()
  }

  // ─── POST /courses/:id/deactivate ─────────────────────────────────────
  @Post(':id/deactivate')
  @Roles('ADMIN')
  @Audit({ action: 'COURSE_DEACTIVATED', entityType: 'Course' })
  async deactivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const c = await this.deactivateUseCase.execute(id)
    return c.toPublicJson()
  }

  // ─── DELETE /courses/:id (alias) ──────────────────────────────────────
  @Delete(':id')
  @Roles('ADMIN')
  @Audit({ action: 'COURSE_DELETED', entityType: 'Course' })
  async delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const c = await this.deactivateUseCase.execute(id)
    return c.toPublicJson()
  }

  // ─── POST /courses/:id/teachers ───────────────────────────────────────
  @Post(':id/teachers')
  @Roles('ADMIN')
  @Audit({ action: 'TEACHERS_ASSIGNED', entityType: 'Course' })
  async assignTeachers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AssignTeachersDtoSchema)) body: AssignTeachersDto,
  ): Promise<unknown> {
    return this.assignTeachersUseCase.execute(id, body.teacherIds)
  }

  // ─── DELETE /courses/:id/teachers/:teacherId ──────────────────────────
  @Delete(':id/teachers/:teacherId')
  @Roles('ADMIN')
  @Audit({ action: 'TEACHER_UNASSIGNED', entityType: 'Course' })
  async unassignTeacher(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('teacherId', new ParseUUIDPipe()) teacherId: string,
  ): Promise<unknown> {
    return this.unassignTeacherUseCase.execute(id, teacherId)
  }

  // ─── POST /courses/:id/enrollments ───────────────────────────────────
  @Post(':id/enrollments')
  @Roles('ADMIN')
  @Audit({ action: 'STUDENTS_ENROLLED', entityType: 'Course' })
  async enrollStudents(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(EnrollStudentsDtoSchema)) body: EnrollStudentsDto,
  ): Promise<unknown> {
    return this.enrollStudentsUseCase.execute(id, body.studentIds)
  }

  // ─── DELETE /courses/:id/enrollments/:studentId ──────────────────────
  @Delete(':id/enrollments/:studentId')
  @Roles('ADMIN')
  @Audit({ action: 'STUDENT_UNENROLLED', entityType: 'Course' })
  async unenrollStudent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ): Promise<unknown> {
    return this.unenrollStudentUseCase.execute(id, studentId)
  }

  // ─── GET /courses/:id/students ───────────────────────────────────────
  @Get(':id/students')
  @Roles('ADMIN', 'TEACHER')
  async listEnrolledStudents(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const students = await this.listEnrolledStudentsUseCase.execute(id)
    return { data: students }
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Throttle } from '@nestjs/throttler'
import type { Express } from 'express'
import { Audit } from '../../../../audit/decorators/audit.decorator'
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard'
import { Roles } from '../../../auth/presentation/decorators/roles.decorator'
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import  { CreateStudentUseCase } from '../../application/use-cases/create-student.use-case'
import  { ListStudentsUseCase } from '../../application/use-cases/list-students.use-case'
import  { GetStudentUseCase } from '../../application/use-cases/get-student.use-case'
import  { UpdateStudentUseCase } from '../../application/use-cases/update-student.use-case'
import  { DeactivateStudentUseCase } from '../../application/use-cases/deactivate-student.use-case'
import  { BulkImportStudentsUseCase } from '../../application/use-cases/bulk-import-students.use-case'
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator'
import type { TokenClaims } from '../../../../shared/crypto/jwt.service'
import {
  CreateStudentDtoSchema,
  type CreateStudentDto,
  type CreateStudentResponse,
} from '../../application/dtos/create-student.dto'
import {
  UpdateStudentDtoSchema,
  type UpdateStudentDto,
} from '../../application/dtos/update-student.dto'
import {
  ListStudentsQueryDtoSchema,
  type ListStudentsQueryDto,
} from '../../application/dtos/list-students.query.dto'
import {
  BulkImportStudentsDtoSchema,
  type BulkImportStudentsDto,
} from '../../application/dtos/bulk-import.dto'

/**
 * StudentsController — `/api/students/*` endpoints.
 * Role-based access:
 *   - ADMIN: full CRUD.
 *   - TEACHER: read-only (list + get), with role-based filtering
 *     so they only see enrolled students.
 */
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TEACHER')
export class StudentsController {
  constructor(
    private readonly createUseCase: CreateStudentUseCase,
    private readonly listUseCase: ListStudentsUseCase,
    private readonly getUseCase: GetStudentUseCase,
    private readonly updateUseCase: UpdateStudentUseCase,
    private readonly deactivateUseCase: DeactivateStudentUseCase,
    private readonly bulkImportUseCase: BulkImportStudentsUseCase,
  ) {}

  // ─── GET /students ─────────────────────────────────────────────────────
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListStudentsQueryDtoSchema)) query: ListStudentsQueryDto,
    @CurrentUser() actor: TokenClaims,
  ): Promise<unknown> {
    const result = await this.listUseCase.execute(
      {
        cursor: query.cursor,
        limit: query.limit,
        isActive: query.isActive ?? null,
        search: query.search ?? null,
        career: query.career ?? null,
      },
      { role: actor.role, userId: actor.sub },
    )
    return {
      data: result.data.map((s) => s.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── POST /students ────────────────────────────────────────────────────
  @Post()
  @Roles('ADMIN')
  @Audit({ action: 'STUDENT_CREATED', entityType: 'User', entityIdFrom: 'result' })
  async create(
    @Body(new ZodValidationPipe(CreateStudentDtoSchema)) body: CreateStudentDto,
  ): Promise<CreateStudentResponse> {
    return this.createUseCase.execute(body)
  }

  // ─── GET /students/:id ─────────────────────────────────────────────────
  @Get(':id')
  async byId(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const s = await this.getUseCase.execute(id)
    return s.toPublicJson()
  }

  // ─── PATCH /students/:id ───────────────────────────────────────────────
  @Patch(':id')
  @Roles('ADMIN')
  @Audit({ action: 'STUDENT_UPDATED', entityType: 'User' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateStudentDtoSchema)) body: UpdateStudentDto,
  ): Promise<unknown> {
    const s = await this.updateUseCase.execute(id, body)
    return s.toPublicJson()
  }

  // ─── POST /students/:id/deactivate ─────────────────────────────────────
  @Post(':id/deactivate')
  @Roles('ADMIN')
  @Audit({ action: 'STUDENT_DEACTIVATED', entityType: 'User' })
  async deactivate(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    const s = await this.deactivateUseCase.execute(id)
    return s.toPublicJson()
  }

  // ─── POST /students/bulk (multipart CSV upload) ──────────────────────
  @Post('bulk')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Audit({ action: 'STUDENTS_BULK_IMPORTED', entityType: 'Student' })
  async bulk(
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(BulkImportStudentsDtoSchema)) dto: BulkImportStudentsDto,
    @CurrentUser() actor: TokenClaims,
  ): Promise<unknown> {
    if (!file) {
      throw new BadRequestException({ message: 'CSV file is required', error: 'Bad Request' })
    }
    return this.bulkImportUseCase.execute(file.buffer, actor.sub, dto)
  }

  // ─── GET /students/bulk/:jobId/status (async job polling) ────────────
  @Get('bulk/:jobId/status')
  @Roles('ADMIN')
  async bulkStatus(@Param('jobId') jobId: string): Promise<unknown> {
    return this.bulkImportUseCase.getJobStatus(jobId)
  }
}

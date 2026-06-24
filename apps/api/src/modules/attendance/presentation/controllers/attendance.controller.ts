import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Audit } from '../../../../audit/decorators/audit.decorator'
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard'
import { Roles } from '../../../auth/presentation/decorators/roles.decorator'
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard'
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe'
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator'
import type { TokenClaims } from '../../../../shared/crypto/jwt.service'
import  { MarkAttendanceUseCase } from '../../application/use-cases/mark-attendance.use-case'
import  { ModifyAttendanceUseCase } from '../../application/use-cases/modify-attendance.use-case'
import  { ListAttendanceUseCase } from '../../application/use-cases/list-attendance.use-case'
import  { AttendanceSummaryUseCase } from '../../application/use-cases/attendance-summary.use-case'
import  { GetAttendanceUseCase } from '../../application/use-cases/get-attendance.use-case'
import  { UploadEvidenceUseCase } from '../../application/use-cases/upload-evidence.use-case'
import {
  MarkAttendanceDtoSchema,
  type MarkAttendanceDto,
} from '../../application/dtos/mark-attendance.dto'
import {
  ModifyAttendanceDtoSchema,
  type ModifyAttendanceDto,
} from '../../application/dtos/modify-attendance.dto'
import {
  ListAttendanceQueryDtoSchema,
  type ListAttendanceQueryDto,
} from '../../application/dtos/list-attendance.query.dto'
import {
  AttendanceSummaryQueryDtoSchema,
  type AttendanceSummaryQueryDto,
} from '../../application/dtos/attendance-summary.query.dto'

/**
 * AttendanceController — `/api/attendance/*` endpoints. The
 * "core" of the product: teachers mark attendance, admins
 * modify / summarize, students view their own history.
 *
 * Endpoints:
 *   POST   /api/attendance              — bulk mark (TEACHER / ADMIN)
 *   GET    /api/attendance              — list (role-filtered)
 *   GET    /api/attendance/summary      — summary by course/student/teacher
 *   GET    /api/attendance/me/attendance — student's own list
 *   GET    /api/attendance/me/summary   — student's own summary
 *   GET    /api/attendance/:id          — single record (TEACHER / ADMIN)
 *   PATCH  /api/attendance/:id          — modify (TEACHER same-day, ADMIN any)
 *   POST   /api/attendance/:id/evidence — upload evidence image (TEACHER)
 *
 * Note: `:id` for GET / PATCH and `/summary` for GET live in the
 * same controller; Nest's router matches `/summary` first
 * because static routes take precedence over params.
 */
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly markUseCase: MarkAttendanceUseCase,
    private readonly modifyUseCase: ModifyAttendanceUseCase,
    private readonly listUseCase: ListAttendanceUseCase,
    private readonly summaryUseCase: AttendanceSummaryUseCase,
    private readonly getUseCase: GetAttendanceUseCase,
    private readonly uploadEvidenceUseCase: UploadEvidenceUseCase,
  ) {}

  // ─── POST /attendance (bulk mark) ────────────────────────────────────
  @Post()
  @Roles('TEACHER', 'ADMIN')
  @Audit({ action: 'ATTENDANCE_MARKED', entityType: 'ClassSession' })
  async mark(
    @Body(new ZodValidationPipe(MarkAttendanceDtoSchema)) body: MarkAttendanceDto,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    const result = await this.markUseCase.execute(body, {
      actorUserId: user.sub,
      actorRole: user.role,
    })
    return {
      sessionId: result.sessionId,
      markedCount: result.created + result.updated,
      created: result.created,
      updated: result.updated,
      presentCount: result.presentCount,
      absentCount: result.absentCount,
      lateCount: result.lateCount,
      justifiedCount: result.justifiedCount,
    }
  }

  // ─── GET /attendance (list) ──────────────────────────────────────────
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListAttendanceQueryDtoSchema)) query: ListAttendanceQueryDto,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    const result = await this.listUseCase.execute(query, { role: user.role, userId: user.sub })
    return {
      data: result.data.map((a) => a.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── GET /attendance/summary (by course/student/teacher) ─────────────
  // NOTE: must be declared BEFORE `:id` to win the static-vs-param
  // route ordering. NestJS uses first-match wins.
  @Get('summary')
  @Roles('TEACHER', 'ADMIN')
  async summary(
    @Query(new ZodValidationPipe(AttendanceSummaryQueryDtoSchema)) query: AttendanceSummaryQueryDto,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    const result = await this.summaryUseCase.executeFromQuery(query, { role: user.role, userId: user.sub })
    return result
  }

  // ─── GET /attendance/me/attendance (student's own list) ─────────────
  @Get('me/attendance')
  @Roles('STUDENT')
  async myAttendance(
    @Query(new ZodValidationPipe(ListAttendanceQueryDtoSchema)) query: ListAttendanceQueryDto,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    const studentId = user.sub
    const result = await this.listUseCase.execute({ ...query, studentId }, { role: user.role, userId: user.sub })
    return {
      data: result.data.map((a) => a.toPublicJson()),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    }
  }

  // ─── GET /attendance/me/summary (student's own summary) ────────────
  @Get('me/summary')
  @Roles('STUDENT')
  async mySummary(
    @Query(new ZodValidationPipe(AttendanceSummaryQueryDtoSchema)) query: AttendanceSummaryQueryDto,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    return this.summaryUseCase.executeStudent(user.sub, query.studentCourseId)
  }

  // ─── GET /attendance/:id (single record) ─────────────────────────────
  @Get(':id')
  async byId(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    const record = await this.getUseCase.execute(id, {
      actorUserId: user.sub,
      actorRole: user.role,
    })
    return record.toPublicJson()
  }

  // ─── PATCH /attendance/:id (modify) ──────────────────────────────────
  @Patch(':id')
  @Roles('TEACHER', 'ADMIN')
  @Audit({ action: 'ATTENDANCE_MODIFIED', entityType: 'AttendanceRecord' })
  async modify(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ModifyAttendanceDtoSchema)) body: ModifyAttendanceDto,
    @CurrentUser() user: TokenClaims,
  ): Promise<unknown> {
    const updated = await this.modifyUseCase.execute(id, body, {
      actorUserId: user.sub,
      actorRole: user.role,
    })
    return updated.toPublicJson()
  }

  // ─── POST /attendance/:id/evidence (image upload) ────────────────────
  @Post(':id/evidence')
  @Roles('TEACHER', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @Audit({ action: 'ATTENDANCE_EVIDENCE_UPLOADED', entityType: 'AttendanceRecord' })
  async uploadEvidence(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<unknown> {
    if (!file) {
      throw new BadRequestException({ message: 'No file uploaded' })
    }
    const updated = await this.uploadEvidenceUseCase.execute(id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    })
    return {
      id: updated.id,
      evidenceUrl: updated.evidenceUrl,
    }
  }
}

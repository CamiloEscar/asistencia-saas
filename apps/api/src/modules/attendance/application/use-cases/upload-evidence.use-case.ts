import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import type { CloudinaryService } from '../../../../shared/cloudinary/cloudinary.service'
import type { IAttendanceRepository } from '../../domain/repositories/attendance.repository.interface'
import { ATTENDANCE_REPOSITORY } from '../../domain/repositories/attendance.repository.interface'
import type { Attendance } from '../../domain/entities/attendance.entity'

/** Max file size: 5MB (per task description). */
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024

/** Allowed MIME types for attendance evidence. */
export const ALLOWED_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const
export type EvidenceMimeType = (typeof ALLOWED_EVIDENCE_MIME_TYPES)[number]

/**
 * UploadEvidenceUseCase — uploads an attendance evidence image
 * to Cloudinary and persists the URL on the attendance record.
 *
 * Per task description:
 *   - Folder pattern: `attendance/{institutionId}/{attendanceId}/`
 *   - File validation: max 5MB, image types only
 *   - Public ID: `evidence` (so re-uploads overwrite)
 *
 * Validation (size + mimetype) lives in the use case so the
 * controller stays thin and the rule is testable in isolation.
 * The audit entry is written by the AuditInterceptor
 * (`@Audit({ action: 'ATTENDANCE_EVIDENCE_UPLOADED' })`).
 */
@Injectable()
export class UploadEvidenceUseCase {
  private readonly logger = new Logger(UploadEvidenceUseCase.name)

  constructor(
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendance: IAttendanceRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async execute(
    attendanceId: string,
    institutionId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<Attendance> {
    // 1. Validate size.
    if (file.size > MAX_EVIDENCE_BYTES) {
      throw new BadRequestException({
        message: `File exceeds ${MAX_EVIDENCE_BYTES / (1024 * 1024)}MB limit`,
        error: 'Bad Request',
        field: 'file',
        maxBytes: MAX_EVIDENCE_BYTES,
        receivedBytes: file.size,
      })
    }

    // 2. Validate mimetype.
    if (
      !ALLOWED_EVIDENCE_MIME_TYPES.includes(
        file.mimetype as (typeof ALLOWED_EVIDENCE_MIME_TYPES)[number],
      )
    ) {
      throw new BadRequestException({
        message: `Unsupported file type: ${file.mimetype}. Allowed: ${ALLOWED_EVIDENCE_MIME_TYPES.join(', ')}`,
        error: 'Bad Request',
        field: 'file',
        allowed: ALLOWED_EVIDENCE_MIME_TYPES,
        received: file.mimetype,
      })
    }

    // 3. Verify the attendance record exists in this institution.
    //    A missing record would create a dangling Cloudinary asset,
    //    so we check up front.
    const existing = await this.attendance.findByIdInInstitution(institutionId, attendanceId)
    if (!existing) {
      throw new BadRequestException({
        message: 'Attendance record not found',
        error: 'Bad Request',
        field: 'id',
      })
    }

    // 4. Upload to Cloudinary.
    const folder = `attendance/${institutionId}/${attendanceId}`
    const result = await this.cloudinary.uploadImage(file.buffer, {
      folder,
      publicId: 'evidence',
    })

    // 5. Persist the URL on the attendance row.
    const updated = await this.attendance.updateByIdInInstitution(
      institutionId,
      attendanceId,
      { evidenceUrl: result.url },
      'system:upload-evidence',
    )

    this.logger.log(
      `uploadEvidence: attendance=${attendanceId} institution=${institutionId} url=${result.url}`,
    )

    return updated
  }
}

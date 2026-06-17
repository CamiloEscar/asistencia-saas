import { BadRequestException } from '@nestjs/common'
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_BYTES,
  UploadEvidenceUseCase,
} from '../application/use-cases/upload-evidence.use-case'
import type { IAttendanceRepository } from '../domain/repositories/attendance.repository.interface'
import type { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service'
import type { Attendance } from '../domain/entities/attendance.entity'

/**
 * Unit tests for UploadEvidenceUseCase.
 *  - happy path: uploads + persists URL
 *  - rejects oversize files
 *  - rejects non-image MIME types
 *  - rejects when attendance record does not exist
 */
describe('UploadEvidenceUseCase', () => {
  const institutionId = 'i-1'
  const attendanceId = 'att-1'

  let attendance: jest.Mocked<IAttendanceRepository>
  let cloudinary: jest.Mocked<Pick<CloudinaryService, 'uploadImage'>>

  const fakeFile = (overrides: { size?: number; mimetype?: string } = {}) => ({
    buffer: Buffer.from('fake image bytes'),
    mimetype: overrides.mimetype ?? 'image/jpeg',
    size: overrides.size ?? 1024,
  })

  const fakeAttendance = (): Attendance =>
    ({
      id: attendanceId,
      institutionId,
      sessionId: 's-1',
      studentId: 'stu-1',
      status: 'PRESENT',
      recordedBy: 'u-1',
      recordedAt: new Date(),
      updatedAt: new Date(),
      evidenceUrl: null,
      toPublicJson: () => ({}),
    }) as unknown as Attendance

  beforeEach(() => {
    attendance = {
      findByIdInInstitution: jest.fn().mockResolvedValue(fakeAttendance()),
      updateByIdInInstitution: jest.fn().mockImplementation(async () => ({
        ...fakeAttendance(),
        evidenceUrl: 'https://cdn.cloudinary.com/asistencia-saas/attendance/i-1/att-1/evidence',
      })),
      bulkCreateOrUpdate: jest.fn(),
      listInInstitution: jest.fn(),
      summaryByCourse: jest.fn(),
      summaryByStudent: jest.fn(),
      summaryByTeacher: jest.fn(),
      validateStudentsEnrolledInCourse: jest.fn(),
    } as unknown as jest.Mocked<IAttendanceRepository>

    cloudinary = {
      uploadImage: jest.fn().mockResolvedValue({
        url: 'https://cdn.cloudinary.com/asistencia-saas/attendance/i-1/att-1/evidence',
        publicId: 'asistencia-saas/attendance/i-1/att-1/evidence',
        width: 800,
        height: 600,
        format: 'jpg',
      }),
    } as unknown as jest.Mocked<Pick<CloudinaryService, 'uploadImage'>>
  })

  it('uploads and persists the URL (happy path)', async () => {
    const useCase = new UploadEvidenceUseCase(attendance, cloudinary as never)
    const result = await useCase.execute(attendanceId, institutionId, fakeFile())
    expect(result.evidenceUrl).toContain('cloudinary.com')
    expect(cloudinary.uploadImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        folder: `attendance/${institutionId}/${attendanceId}`,
        publicId: 'evidence',
      }),
    )
    expect(attendance.updateByIdInInstitution).toHaveBeenCalledWith(
      institutionId,
      attendanceId,
      { evidenceUrl: expect.stringContaining('cloudinary.com') },
      'system:upload-evidence',
    )
  })

  it('rejects files larger than 5MB', async () => {
    const useCase = new UploadEvidenceUseCase(attendance, cloudinary as never)
    await expect(
      useCase.execute(attendanceId, institutionId, fakeFile({ size: MAX_EVIDENCE_BYTES + 1 })),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(cloudinary.uploadImage).not.toHaveBeenCalled()
  })

  it('accepts a file exactly at the size limit', async () => {
    const useCase = new UploadEvidenceUseCase(attendance, cloudinary as never)
    await useCase.execute(attendanceId, institutionId, fakeFile({ size: MAX_EVIDENCE_BYTES }))
    expect(cloudinary.uploadImage).toHaveBeenCalled()
  })

  it('rejects unsupported MIME types', async () => {
    const useCase = new UploadEvidenceUseCase(attendance, cloudinary as never)
    await expect(
      useCase.execute(attendanceId, institutionId, fakeFile({ mimetype: 'application/pdf' })),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(cloudinary.uploadImage).not.toHaveBeenCalled()
  })

  it.each(ALLOWED_EVIDENCE_MIME_TYPES)('accepts MIME type %s', async (mimetype) => {
    const useCase = new UploadEvidenceUseCase(attendance, cloudinary as never)
    await useCase.execute(attendanceId, institutionId, fakeFile({ mimetype }))
    expect(cloudinary.uploadImage).toHaveBeenCalled()
  })

  it('returns 400 when the attendance record does not exist (avoids dangling assets)', async () => {
    attendance.findByIdInInstitution.mockResolvedValue(null)
    const useCase = new UploadEvidenceUseCase(attendance, cloudinary as never)
    await expect(useCase.execute('att-missing', institutionId, fakeFile())).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(cloudinary.uploadImage).not.toHaveBeenCalled()
  })

  it('preserves error metadata for RFC 7807 (maxBytes + receivedBytes)', async () => {
    const useCase = new UploadEvidenceUseCase(attendance, cloudinary as never)
    try {
      await useCase.execute(attendanceId, institutionId, fakeFile({ size: 6 * 1024 * 1024 }))
      fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const e = err as BadRequestException
      const body = e.getResponse() as { maxBytes: number; receivedBytes: number }
      expect(body.maxBytes).toBe(MAX_EVIDENCE_BYTES)
      expect(body.receivedBytes).toBe(6 * 1024 * 1024)
    }
  })
})

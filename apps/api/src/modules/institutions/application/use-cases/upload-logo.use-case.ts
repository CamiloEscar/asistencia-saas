import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Express } from 'express'
import type { CloudinaryService, CloudinaryUploadResult } from '../../../../shared/cloudinary/cloudinary.service'
import {
  INSTITUTION_REPOSITORY,
  type IInstitutionRepository,
} from '../../domain/repositories/institution.repository.interface'
import type { Institution } from '../../domain/entities/institution.entity'

/**
 * UploadLogoUseCase — uploads a logo image to Cloudinary and
 * updates the institution's `logoUrl` field. The folder is
 * `institutions/{institutionId}/logo` per spec REQ-INST-007.
 *
 * Validation (MIME type, max 2MB) is enforced by the controller's
 * `FileInterceptor` + `ParseFilePipe` before this use case is called.
 * If the file is rejected at the controller, this method never runs.
 */
@Injectable()
export class UploadLogoUseCase {
  constructor(
    @Inject(INSTITUTION_REPOSITORY)
    private readonly institutions: IInstitutionRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async execute(institutionId: string, file: Express.Multer.File): Promise<Institution> {
    const existing = await this.institutions.findById(institutionId)
    if (!existing) {
      throw new NotFoundException({ message: 'Institution not found', error: 'Not Found' })
    }

    const folder = `institutions/${institutionId}/logo`
    const publicId = 'logo'

    const result: CloudinaryUploadResult = await this.cloudinary.uploadImage(
      file.buffer,
      { folder, publicId },
    )

    return this.institutions.updateLogo(institutionId, result.url)
  }
}

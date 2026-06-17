import { Injectable, Logger } from '@nestjs/common'
import { v2 as cloudinary } from 'cloudinary'

/**
 * Cloudinary upload result shape returned to the application layer.
 * The full Cloudinary response is rich; we project the fields the FE
 * actually needs to display the uploaded image.
 */
export interface CloudinaryUploadResult {
  url: string
  publicId: string
  width: number
  height: number
  format: string
}

/**
 * Cloudinary upload options. We default to `f_auto,q_auto` so the
 * browser gets WebP/AVIF where supported, and the quality is tuned
 * per asset.
 */
export interface CloudinaryUploadOptions {
  folder: string
  publicId?: string
  width?: number
  height?: number
  crop?: 'fill' | 'fit' | 'limit' | 'scale' | 'pad'
}

/**
 * CloudinaryService — shared upload helper used by the institutions
 * module (logo upload) and the attendance module (evidence images
 * in a later phase). Wraps the Cloudinary SDK with two safety nets:
 *
 *  1. Lazy configuration: if env vars are missing (e.g., local dev
 *     without a Cloudinary account), the service logs a warning and
 *     returns a placeholder URL. The request still succeeds, which
 *     is the spec's intended behavior (logo upload is optional in
 *     the create-institution flow, per design R4).
 *  2. Folder scoping: every upload MUST specify a `folder` argument;
 *     we prefix it with the configured `CLOUDINARY_FOLDER` env so
 *     multi-tenant uploads stay isolated.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name)
  private readonly configured: boolean
  private readonly baseFolder: string
  private readonly cloudName: string
  private readonly apiKey: string
  private readonly apiSecret: string

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? ''
    this.apiKey = process.env.CLOUDINARY_API_KEY ?? ''
    this.apiSecret = process.env.CLOUDINARY_API_SECRET ?? ''
    this.baseFolder = process.env.CLOUDINARY_FOLDER ?? 'asistencia-saas'
    this.configured = Boolean(this.cloudName && this.apiKey && this.apiSecret)

    if (this.configured) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      })
      this.logger.log(`Cloudinary configured (cloud: ${this.cloudName})`)
    } else {
      this.logger.warn(
        'Cloudinary env vars missing — uploads will return placeholder URLs. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to enable real uploads.',
      )
    }
  }

  /**
   * Upload a binary buffer (e.g., from a multipart request) to the
   * specified folder. Returns the CDN URL + the publicId (for
   * later deletion).
   *
   * In dev without Cloudinary configured, returns a deterministic
   * placeholder URL based on the publicId so the FE still has
   * something to display.
   */
  async uploadImage(
    buffer: Buffer,
    options: CloudinaryUploadOptions,
  ): Promise<CloudinaryUploadResult> {
    const folder = `${this.baseFolder}/${options.folder}`.replace(/^\/+/, '').replace(/\/+$/, '')
    const publicId = options.publicId ?? `img_${Date.now()}`

    if (!this.configured) {
      this.logger.warn(
        `Cloudinary not configured — returning placeholder URL for ${folder}/${publicId}`,
      )
      return this.placeholder(folder, publicId)
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: true,
          resource_type: 'image',
          ...(options.width ? { width: options.width } : {}),
          ...(options.height ? { height: options.height } : {}),
          ...(options.crop ? { crop: options.crop } : {}),
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(`Cloudinary upload failed: ${error?.message ?? 'no result'}`)
            reject(error ?? new Error('Cloudinary upload returned no result'))
            return
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width ?? 0,
            height: result.height ?? 0,
            format: result.format ?? 'unknown',
          })
        },
      )
      uploadStream.end(buffer)
    })
  }

  /**
   * Delete a previously uploaded asset by its publicId. Used when a
   * logo is replaced and we want to free the old storage slot.
   * Best-effort: failures are logged but do not throw — the API
   * should not block on a CDN cleanup.
   */
  async deleteImage(publicId: string): Promise<void> {
    if (!this.configured) {
      this.logger.warn(`Cloudinary not configured — skipping delete of ${publicId}`)
      return
    }
    try {
      await cloudinary.uploader.destroy(publicId)
    } catch (err) {
      this.logger.warn(`Cloudinary delete failed for ${publicId}: ${(err as Error).message}`)
    }
  }

  /**
   * Build a Cloudinary delivery URL with auto-format + auto-quality
   * optimization. Use this when you need to render an image at a
   * specific size and let Cloudinary pick the best format (WebP,
   * AVIF) for the client.
   */
  getOptimizedUrl(
    publicId: string,
    options: { width?: number; height?: number; format?: string; quality?: string } = {},
  ): string {
    if (!this.configured || !publicId.startsWith(`${this.baseFolder}/`)) {
      return this.placeholder(this.baseFolder, publicId).url
    }
    const transforms: string[] = ['f_auto', options.quality ? `q_${options.quality}` : 'q_auto']
    if (options.width) transforms.push(`w_${options.width}`)
    if (options.height) transforms.push(`h_${options.height}`)
    const transform = transforms.join(',')
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transform}/${publicId}`
  }

  /** Returned when env is missing — gives the FE a stable, identifiable URL. */
  private placeholder(folder: string, publicId: string): CloudinaryUploadResult {
    return {
      url: `https://placehold.co/600x400?text=${encodeURIComponent(`${folder}/${publicId}`)}`,
      publicId: `${folder}/${publicId}`,
      width: 600,
      height: 400,
      format: 'png',
    }
  }
}

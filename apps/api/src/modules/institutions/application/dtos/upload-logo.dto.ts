import { z } from 'zod'

/**
 * Upload-logo DTO. The file is validated as part of the multipart
 * payload; this schema documents the expected shape for the FE.
 * The actual file is captured by the FileInterceptor / ParseFilePipe
 * in the controller — we don't need the buffer in the schema.
 */
export const UploadLogoResponseSchema = z.object({
  logoUrl: z.string().url(),
  publicId: z.string(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  format: z.string(),
})

export type UploadLogoResponse = z.infer<typeof UploadLogoResponseSchema>

/**
 * Maximum file size: 2 MB (per spec REQ-INST-007).
 */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024

/**
 * Allowed MIME types for institution logos.
 */
export const ALLOWED_LOGO_MIME_TYPES = ['image/jpeg', 'image/png'] as const

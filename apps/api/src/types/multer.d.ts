/**
 * Minimal multer type augmentation for the project. The original
 * multer types from `@types/multer` declare Multer as a namespace
 * inside Express (so `Express.Multer.File` resolves). We mirror that
 * shape here so our controllers can type the uploaded file.
 */
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string
        originalname: string
        encoding: string
        mimetype: string
        size: number
        destination?: string
        filename?: string
        path?: string
        buffer: Buffer
      }
    }
  }
}

export {}

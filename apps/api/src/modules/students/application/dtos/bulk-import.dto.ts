import { z } from 'zod'
import { CsvRowSchema } from '../../domain/value-objects/csv-row.vo'

/**
 * Bulk-import student DTO. The `file` is a multipart upload field
 * containing a CSV. `dryRun` runs validation without writing.
 * `courseId` (optional) auto-enrolls the created students in the
 * given course.
 *
 * The actual file contents are NOT validated by Zod — the multipart
 * pipe handles the binary buffer; the CSV parser validates each row
 * against `CsvRowSchema`.
 *
 * Spec: REQ-STUDENT-008 (CSV format), REQ-STUDENT-009 (dry-run),
 * REQ-STUDENT-010 (commit), REQ-STUDENT-011 (idempotency).
 */
export const BulkImportStudentsDtoSchema = z.object({
  dryRun: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
  courseId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  updateExisting: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
})

export type BulkImportStudentsDto = z.infer<typeof BulkImportStudentsDtoSchema>

/** Re-export the row schema so consumers (FE, swagger) can reference it. */
export { CsvRowSchema }
export type { CsvRow } from '../../domain/value-objects/csv-row.vo'

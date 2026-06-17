import { z } from 'zod'
import type { CsvRowError } from '../../domain/value-objects/csv-row.vo'

/**
 * Bulk-import result DTO. Three shapes:
 *  - `dryRun: true` → returns `{ valid, totalRows, validRows, errors, preview }`.
 *  - `dryRun: false` (sync, ≤500 rows) → returns the commit result.
 *  - `dryRun: false` (async, >500 rows) → returns `{ jobId, status: 'queued', estimatedRows }`.
 *
 * The FE discriminates by the presence of `jobId` (async) or `created` (sync).
 */
export const CsvRowErrorSchema = z.object({
  row: z.number().int().positive(),
  field: z.string().nullable(),
  message: z.string(),
})

export const BulkImportPreviewRowSchema = z.object({
  legajo: z.string(),
  nombre: z.string(),
  apellido: z.string(),
  email: z.string().nullable().optional(),
})

export const BulkImportDryRunResultSchema = z.object({
  valid: z.boolean(),
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  errors: z.array(CsvRowErrorSchema),
  preview: z.array(BulkImportPreviewRowSchema).max(20),
})

export const BulkImportCommitResultSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors: z.array(CsvRowErrorSchema),
})

export const BulkImportAsyncAcceptedSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal('queued'),
  estimatedRows: z.number().int().positive(),
})

export type BulkImportDryRunResult = z.infer<typeof BulkImportDryRunResultSchema>
export type BulkImportCommitResult = z.infer<typeof BulkImportCommitResultSchema>
export type BulkImportAsyncAccepted = z.infer<typeof BulkImportAsyncAcceptedSchema>

/** Job status response (for the polling endpoint). */
export const BulkImportJobStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number().int().min(0).max(100),
  result: BulkImportCommitResultSchema.optional(),
  failedReason: z.string().optional(),
})

export type BulkImportJobStatus = z.infer<typeof BulkImportJobStatusSchema>

// Re-export for convenience
export type { CsvRowError }

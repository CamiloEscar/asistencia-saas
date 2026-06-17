import { z } from 'zod'
import { LegajoSchema } from './legajo.vo'

/**
 * CSV row schema for the bulk student import. Validates a single row
 * of the CSV after header normalization. Used by `CsvParserService`
 * to validate each row before the data hits the DB.
 *
 * Required fields:
 *   - legajo: alphanumeric 3-30 chars (case-insensitive)
 *   - nombre: 1-100 chars
 *   - apellido: 1-100 chars
 *
 * Optional fields:
 *   - email: valid email format
 *   - telefono: free-form string, max 30 chars
 *   - fecha_nacimiento: ISO date (YYYY-MM-DD)
 *   - carrera: free-form string, max 100 chars
 *
 * Error format: `{ row, field, message }` per the spec
 * (REQ-STUDENT-014). Field-level errors carry the column name;
 * row-level errors (column count mismatch) carry `field: null`.
 */
export const CsvRowSchema = z.object({
  legajo: LegajoSchema,
  nombre: z.string().trim().min(1, 'nombre is required').max(100),
  apellido: z.string().trim().min(1, 'apellido is required').max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email format')
    .max(254)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  telefono: z
    .string()
    .trim()
    .max(30, 'telefono must be at most 30 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  fecha_nacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_nacimiento must be YYYY-MM-DD')
    .refine(
      (s) => {
        const d = new Date(s)
        return !Number.isNaN(d.getTime())
      },
      { message: 'fecha_nacimiento must be a valid date' },
    )
    .optional()
    .or(z.literal('').transform(() => undefined)),
  carrera: z
    .string()
    .trim()
    .max(100, 'carrera must be at most 100 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export type CsvRow = z.infer<typeof CsvRowSchema>

/**
 * Standard error format for CSV import (REQ-STUDENT-014).
 * `row` is 1-based and references the data row (excluding the header).
 * `field` is null for row-level errors.
 */
export interface CsvRowError {
  row: number
  field: string | null
  message: string
}

export interface CsvRowErrorInternal extends CsvRowError {
  /** The raw value that failed validation (for preview/debug). */
  value?: unknown
}

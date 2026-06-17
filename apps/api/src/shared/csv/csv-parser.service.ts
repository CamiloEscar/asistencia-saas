import { Injectable, Logger } from '@nestjs/common'
import { parse as csvParse, type Options as CsvParseOptions } from 'csv-parse'
import {
  CsvRowSchema,
  type CsvRowError,
} from '../../modules/students/domain/value-objects/csv-row.vo'

/**
 * CsvParserService — shared CSV parser for bulk imports.
 *
 * Used by the students module's bulk import flow (and any future
 * module that ingests CSV). Streams the input, validates each row
 * against a Zod schema, and returns per-row errors.
 *
 * The first row is treated as the header. Columns are matched by
 * name (case-insensitive) to the schema's keys. Unrecognized
 * columns are dropped silently (forward compatibility: a new
 * column in the CSV doesn't break the import).
 *
 * Spec: REQ-STUDENT-008 (CSV format), REQ-STUDENT-014 (error format).
 */

export const EXPECTED_HEADERS = [
  'legajo',
  'nombre',
  'apellido',
  'email',
  'telefono',
  'fecha_nacimiento',
  'carrera',
] as const

export type CsvHeader = (typeof EXPECTED_HEADERS)[number]

export interface ParsedCsvRow {
  /** 1-based row number, excluding the header (so the first data row is `1`). */
  row: number
  values: Record<string, string>
}

export interface CsvParseSuccess {
  rows: ParsedCsvRow[]
  errors: CsvRowError[]
  totalRows: number
}

export interface CsvParseFailure {
  /** The whole file is rejected (header missing, encoding, too large). */
  fatal: true
  message: string
  errors: CsvRowError[]
}

@Injectable()
export class CsvParserService {
  private readonly logger = new Logger(CsvParserService.name)

  /**
   * Parse a CSV buffer and validate every row against `CsvRowSchema`.
   *
   * @param buffer Raw CSV bytes (UTF-8 expected).
   * @param opts.maxRows Hard cap on data rows (default 5000).
   * @param opts.maxBytes Hard cap on input size (default 5MB).
   * @returns Either a `CsvParseSuccess` (header ok, rows validated)
   *          or a `CsvParseFailure` (header missing, file too large, etc.).
   */
  async parseStudentCsv(
    buffer: Buffer,
    opts: { maxRows?: number; maxBytes?: number } = {},
  ): Promise<CsvParseSuccess | CsvParseFailure> {
    const maxRows = opts.maxRows ?? 5000
    const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024 // 5 MB

    if (buffer.length === 0) {
      return { fatal: true, message: 'CSV file is empty', errors: [] }
    }
    if (buffer.length > maxBytes) {
      return {
        fatal: true,
        message: `File exceeds ${(maxBytes / (1024 * 1024)).toFixed(0)}MB limit`,
        errors: [],
      }
    }

    // Quick UTF-8 sanity check: try to decode the whole buffer.
    // We don't reject Latin-1 outright (it's a common source of
    // mojibake in LATAM institutions) — we just log a warning.
    const text = buffer.toString('utf-8')
    if (text.includes('\uFFFD')) {
      this.logger.warn('CSV contains U+FFFD replacement characters — file is likely not UTF-8')
    }

    const records = await this.parseRecords(text)
    if (records.length === 0) {
      return { fatal: true, message: 'CSV file has no rows', errors: [] }
    }

    // The first row is the header. Expected columns: legajo,
    // nombre, apellido (required); email, telefono, fecha_nacimiento,
    // carrera (optional). We require at least the required columns
    // to be present in the header.
    const headerCells = records[0]!.map((c) => c.trim().toLowerCase())
    const missingRequired = ['legajo', 'nombre', 'apellido'].filter((c) => !headerCells.includes(c))
    if (missingRequired.length > 0) {
      return {
        fatal: true,
        message: `CSV header is missing required columns: ${missingRequired.join(', ')}`,
        errors: [],
      }
    }

    const headerIndex = new Map<string, number>()
    headerCells.forEach((c, i) => {
      headerIndex.set(c, i)
    })

    const dataRecords = records.slice(1)
    if (dataRecords.length > maxRows) {
      return {
        fatal: true,
        message: `Maximum ${maxRows} rows per import`,
        errors: [],
      }
    }

    const errors: CsvRowError[] = []
    const validRows: ParsedCsvRow[] = []

    for (let i = 0; i < dataRecords.length; i += 1) {
      const record = dataRecords[i]!
      const rowNumber = i + 1 // 1-based, excludes header

      if (record.length !== headerCells.length) {
        errors.push({
          row: rowNumber,
          field: null,
          message: `Expected ${headerCells.length} columns, got ${record.length}`,
        })
        continue
      }

      const values: Record<string, string> = {}
      for (const [col, idx] of headerIndex.entries()) {
        const raw = record[idx]
        values[col] = (raw ?? '').trim()
      }

      const result = CsvRowSchema.safeParse(values)
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            row: rowNumber,
            field: issue.path.join('.') || null,
            message: issue.message,
          })
        }
        continue
      }

      validRows.push({ row: rowNumber, values: result.data as unknown as Record<string, string> })
    }

    return {
      rows: validRows,
      errors,
      totalRows: dataRecords.length,
    }
  }

  private parseRecords(text: string): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const records: string[][] = []
      const options: CsvParseOptions = {
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }
      const parser = csvParse(options, (err, output) => {
        if (err) {
          reject(err)
          return
        }
        resolve(output as string[][])
      })
      parser.on('data', (record: string[]) => {
        records.push(record)
      })
      parser.on('end', () => {
        // csv-parse resolves via the callback; this is a no-op
        // safety net.
        if (records.length > 0) resolve(records)
      })
      parser.on('error', (err) => reject(err))
      parser.write(text)
      parser.end()
    })
  }
}

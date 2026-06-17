import type { CsvParserService, ParsedCsvRow } from './csv-parser.service'

/**
 * Tiny factory for building `ParsedCsvRow` values in tests.
 * Kept minimal — just enough to drive the parser's happy path.
 */
export const csvRow = (values: Record<string, string>, row = 1): ParsedCsvRow => ({
  row,
  values,
})

export const studentCsv = (overrides: Partial<Record<string, string>> = {}): string => {
  const base = {
    legajo: '2024-001',
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'juan@x.com',
    telefono: '555-0001',
    fecha_nacimiento: '2000-01-01',
    carrera: 'Ingeniería',
  }
  return Object.entries({ ...base, ...overrides })
    .map(([k, v]) => `${k},${v}`)
    .join('\n')
}

/** Build a CsvParserService double with the parseStudentCsv method
 *  stubbed. The test sets the stub's resolved value. */
export const makeCsvParserStub = (
  resolved: Awaited<ReturnType<CsvParserService['parseStudentCsv']>>,
): Pick<CsvParserService, 'parseStudentCsv'> => ({
  parseStudentCsv: jest.fn().mockResolvedValue(resolved),
})

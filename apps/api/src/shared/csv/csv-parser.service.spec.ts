import { CsvParserService } from './csv-parser.service'

/**
 * Unit tests for `CsvParserService.parseStudentCsv`. Three scenarios:
 *   1. Valid CSV with header + 3 rows
 *   2. Malformed CSV (missing required column in header)
 *   3. Invalid rows (one row has a bad email)
 */
describe('CsvParserService', () => {
  let service: CsvParserService

  beforeEach(() => {
    service = new CsvParserService()
  })

  it('parses a valid CSV (happy path)', async () => {
    const csv = [
      'legajo,nombre,apellido,email,telefono,fecha_nacimiento,carrera',
      '2024-001,Juan,Pérez,juan@x.com,555-0001,2000-01-01,Ing',
      '2024-002,Ana,García,ana@x.com,555-0002,2000-02-02,Ing',
      '2024-003,Luisa,López,luisa@x.com,,2000-03-03,',
    ].join('\n')

    const result = await service.parseStudentCsv(Buffer.from(csv, 'utf-8'))
    expect('fatal' in result).toBe(false)
    if ('fatal' in result) return
    expect(result.totalRows).toBe(3)
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0]?.values['legajo']).toBe('2024-001')
    expect(result.rows[0]?.values['nombre']).toBe('Juan')
  })

  it('rejects a CSV missing required header columns', async () => {
    const csv = [
      'legajo,nombre,email', // missing `apellido`
      '2024-001,Juan,juan@x.com',
    ].join('\n')

    const result = await service.parseStudentCsv(Buffer.from(csv, 'utf-8'))
    expect('fatal' in result).toBe(true)
    if (!('fatal' in result)) return
    expect(result.message).toMatch(/missing required columns/i)
    expect(result.message).toContain('apellido')
  })

  it('rejects individual rows with invalid email (per-row error)', async () => {
    const csv = [
      'legajo,nombre,apellido,email,telefono,fecha_nacimiento,carrera',
      '2024-001,Juan,Pérez,juan@x.com,555-0001,2000-01-01,Ing',
      '2024-002,Ana,García,not-an-email,555-0002,2000-02-02,Ing',
      '2024-003,Luisa,López,luisa@x.com,555-0003,2000-03-03,Ing',
    ].join('\n')

    const result = await service.parseStudentCsv(Buffer.from(csv, 'utf-8'))
    expect('fatal' in result).toBe(false)
    if ('fatal' in result) return
    expect(result.totalRows).toBe(3)
    expect(result.errors.length).toBeGreaterThan(0)
    // The bad row is row 2 (1-based, excluding header)
    const row2Error = result.errors.find((e) => e.row === 2)
    expect(row2Error).toBeDefined()
    expect(row2Error?.field).toBe('email')
  })
})

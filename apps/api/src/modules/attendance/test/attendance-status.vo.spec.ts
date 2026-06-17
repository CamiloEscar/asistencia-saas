import {
  ATTENDANCE_STATUSES,
  AttendanceStatus,
  AttendanceStatusSchema,
  InvalidAttendanceStatusError,
} from '../domain/value-objects/attendance-status.vo'

/**
 * Unit tests for the AttendanceStatus VO. Covers:
 *  - All 4 valid states are accepted (REQ-ATT-006)
 *  - Invalid values are rejected (422 via InvalidAttendanceStatusError)
 *  - The default() helper returns PRESENT (REQ-ATT-001-06)
 *  - The Zod schema matches the VO surface
 */
describe('AttendanceStatus', () => {
  describe('create()', () => {
    it.each(ATTENDANCE_STATUSES)('accepts the %s status', (s) => {
      const vo = AttendanceStatus.create(s)
      expect(vo.value).toBe(s)
      expect(vo.toString()).toBe(s)
    })

    it('rejects unknown string values', () => {
      expect(() => AttendanceStatus.create('UNKNOWN')).toThrow(InvalidAttendanceStatusError)
      expect(() => AttendanceStatus.create('present')).toThrow(InvalidAttendanceStatusError) // case-sensitive
      expect(() => AttendanceStatus.create('PRESENTED')).toThrow(InvalidAttendanceStatusError)
    })

    it('rejects non-string values', () => {
      expect(() => AttendanceStatus.create(null)).toThrow(InvalidAttendanceStatusError)
      expect(() => AttendanceStatus.create(undefined)).toThrow(InvalidAttendanceStatusError)
      expect(() => AttendanceStatus.create(123)).toThrow(InvalidAttendanceStatusError)
      expect(() => AttendanceStatus.create({})).toThrow(InvalidAttendanceStatusError)
    })

    it('preserves the error code (422) and value for RFC 7807 mapping', () => {
      try {
        AttendanceStatus.create('FOO')
        fail('expected throw')
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidAttendanceStatusError)
        const e = err as InvalidAttendanceStatusError
        expect(e.status).toBe(422)
        expect(e.code).toBe('INVALID_ATTENDANCE_STATUS')
        expect(e.received).toBe('FOO')
      }
    })
  })

  describe('default()', () => {
    it('returns PRESENT', () => {
      const vo = AttendanceStatus.default()
      expect(vo.value).toBe('PRESENT')
    })
  })

  describe('fromPersistence()', () => {
    it('accepts a known value coming back from the DB', () => {
      const vo = AttendanceStatus.fromPersistence('LATE')
      expect(vo.value).toBe('LATE')
    })
    it('rejects a corrupted DB value', () => {
      expect(() => AttendanceStatus.fromPersistence('BANANA')).toThrow(InvalidAttendanceStatusError)
    })
  })

  describe('equals()', () => {
    it('returns true for the same value', () => {
      const a = AttendanceStatus.create('ABSENT')
      const b = AttendanceStatus.create('ABSENT')
      expect(a.equals(b)).toBe(true)
    })
    it('returns false for different values', () => {
      const a = AttendanceStatus.create('ABSENT')
      const b = AttendanceStatus.create('LATE')
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('Zod schema', () => {
    it('parses all 4 valid values', () => {
      for (const s of ATTENDANCE_STATUSES) {
        const r = AttendanceStatusSchema.parse(s)
        expect(r).toBe(s)
      }
    })
    it('rejects invalid values', () => {
      const r = AttendanceStatusSchema.safeParse('FOO')
      expect(r.success).toBe(false)
    })
  })
})

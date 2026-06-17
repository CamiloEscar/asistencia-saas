import {
  JustificationText,
  JustificationTextTooLongError,
} from '../domain/value-objects/justification-text.vo'

/**
 * Unit tests for the JustificationText VO (REQ-ATT-009).
 *  - Null/undefined → empty
 *  - Short text accepted
 *  - 500-char boundary accepted
 *  - 501+ chars rejected with 422
 */
describe('JustificationText', () => {
  it('accepts null and undefined as "no justification"', () => {
    expect(JustificationText.create(null).value).toBeNull()
    expect(JustificationText.create(undefined).value).toBeNull()
    expect(JustificationText.empty().value).toBeNull()
  })

  it('accepts a short justification', () => {
    const vo = JustificationText.create('Certificado médico')
    expect(vo.value).toBe('Certificado médico')
    expect(vo.isEmpty).toBe(false)
  })

  it('trims whitespace', () => {
    const vo = JustificationText.create('  hola  ')
    expect(vo.value).toBe('hola')
  })

  it('accepts exactly 500 characters (boundary)', () => {
    const text = 'a'.repeat(500)
    expect(JustificationText.create(text).value).toBe(text)
  })

  it('rejects 501+ characters', () => {
    const text = 'a'.repeat(501)
    expect(() => JustificationText.create(text)).toThrow(JustificationTextTooLongError)
  })

  it('preserves error code for RFC 7807 mapping', () => {
    try {
      JustificationText.create('a'.repeat(600))
      fail('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(JustificationTextTooLongError)
      const e = err as JustificationTextTooLongError
      expect(e.status).toBe(422)
      expect(e.code).toBe('JUSTIFICATION_TOO_LONG')
    }
  })

  it('fromPersistence() accepts a stored value', () => {
    const vo = JustificationText.fromPersistence('stored text')
    expect(vo.value).toBe('stored text')
  })

  it('fromPersistence() treats null/undefined as empty', () => {
    expect(JustificationText.fromPersistence(null).value).toBeNull()
    expect(JustificationText.fromPersistence(undefined).value).toBeNull()
  })
})

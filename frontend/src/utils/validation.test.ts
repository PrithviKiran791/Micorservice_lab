import { describe, expect, it } from 'vitest'
import { toCreateRequest, validateIncident, validatePassword, validateUsername } from './validation'

describe('validateUsername (backend rule: 3-50 characters, letters digits _ . -)', () => {
  it('accepts valid names', () => {
    expect(validateUsername('asha')).toBeUndefined()
    expect(validateUsername('a.b-c_9')).toBeUndefined()
    expect(validateUsername('x'.repeat(50))).toBeUndefined()
  })
  it('rejects empty, short, long and illegal characters', () => {
    expect(validateUsername('')).toBeDefined()
    expect(validateUsername('ab')).toBeDefined()
    expect(validateUsername('x'.repeat(51))).toBeDefined()
    expect(validateUsername('has space')).toBeDefined()
    expect(validateUsername('semi;colon')).toBeDefined()
  })
})

describe('validatePassword (backend rule: 8-72 characters)', () => {
  it('accepts 8 to 72 characters', () => {
    expect(validatePassword('12345678')).toBeUndefined()
    expect(validatePassword('p'.repeat(72))).toBeUndefined()
  })
  it('rejects empty, short and too long', () => {
    expect(validatePassword('')).toBeDefined()
    expect(validatePassword('1234567')).toBeDefined()
    expect(validatePassword('p'.repeat(73))).toBeDefined()
  })
})

describe('validateIncident', () => {
  const valid = { type: 'FIRE', severity: 'LOW', description: 'smoke', locationText: 'lab' } as const

  it('passes a complete report', () => {
    expect(validateIncident({ ...valid })).toEqual({})
  })
  it('requires every field', () => {
    const errors = validateIncident({ type: '', severity: '', description: '  ', locationText: '' })
    expect(Object.keys(errors).sort()).toEqual(['description', 'locationText', 'severity', 'type'])
  })
  it('enforces the length limits (description 500, location 200)', () => {
    expect(validateIncident({ ...valid, description: 'd'.repeat(501) }).description).toBeDefined()
    expect(validateIncident({ ...valid, description: 'd'.repeat(500) }).description).toBeUndefined()
    expect(validateIncident({ ...valid, locationText: 'l'.repeat(201) }).locationText).toBeDefined()
  })
})

describe('toCreateRequest', () => {
  it('trims text and sends only fields the API knows (no invented coordinates)', () => {
    const body = toCreateRequest({ type: 'POLICE', severity: 'MEDIUM', description: '  noise  ', locationText: ' hostel ' })
    expect(body).toEqual({ type: 'POLICE', severity: 'MEDIUM', description: 'noise', locationText: 'hostel' })
  })
})

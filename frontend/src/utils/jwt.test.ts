import { describe, expect, it } from 'vitest'
import { fakeJwt } from '../test/fixtures'
import { getTokenExpiryMs } from './jwt'

describe('getTokenExpiryMs', () => {
  it('reads the exp claim in milliseconds', () => {
    expect(getTokenExpiryMs(fakeJwt(1_800_000_000))).toBe(1_800_000_000_000)
  })

  it('returns null for malformed tokens instead of throwing', () => {
    expect(getTokenExpiryMs('')).toBeNull()
    expect(getTokenExpiryMs('not-a-jwt')).toBeNull()
    expect(getTokenExpiryMs('a.%%%.c')).toBeNull()
  })

  it('returns null when there is no numeric exp', () => {
    const noExp = `${btoa('{"alg":"HS256"}')}.${btoa('{"sub":"2"}')}.sig`
    expect(getTokenExpiryMs(noExp)).toBeNull()
  })
})

import { AxiosError, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeJwt } from '../test/fixtures'
import { AppError, toAppError } from './errors'
import { tokenStore, type Session } from './tokenStore'

function axiosError(status: number, data: unknown): AxiosError {
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never } as AxiosResponse)
}

describe('toAppError', () => {
  it('maps the standard backend error body (code, message, field details)', () => {
    const e = toAppError(axiosError(400, { code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ field: 'description', message: 'must not be blank' }] }))
    expect(e).toBeInstanceOf(AppError)
    expect(e.status).toBe(400)
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.details).toEqual([{ field: 'description', message: 'must not be blank' }])
  })

  it('writes friendly messages for the known cases', () => {
    expect(toAppError(axiosError(401, { code: 'INVALID_CREDENTIALS', message: 'x' })).message).toBe('Wrong username or password.')
    expect(toAppError(axiosError(409, { code: 'USERNAME_TAKEN', message: 'x' })).code).toBe('USERNAME_TAKEN')
    expect(toAppError(axiosError(403, { code: 'FORBIDDEN', message: 'x' })).message).toMatch(/not allowed/)
    expect(toAppError(axiosError(503, { code: 'SERVICE_UNAVAILABLE', message: 'x' })).message).toMatch(/temporarily unavailable/)
  })

  it('treats a missing response as a network error', () => {
    const e = toAppError(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(e.network).toBe(true)
    expect(e.status).toBe(0)
  })

  it('copes with a non-JSON error body', () => {
    const e = toAppError(axiosError(502, '<html>Bad gateway</html>'))
    expect(e.status).toBe(502)
    expect(e.code).toBe('HTTP_502')
  })

  it('wraps unknown errors and keeps AppError unchanged', () => {
    expect(toAppError(new Error('boom')).message).toBe('boom')
    const original = new AppError('m', 404, 'NOT_FOUND')
    expect(toAppError(original)).toBe(original)
  })
})

describe('tokenStore', () => {
  afterEach(() => sessionStorage.clear())
  const session = (expiresAt: number): Session => ({ token: fakeJwt(1), user: { id: 2, username: 'asha', role: 'USER' }, expiresAt })

  it('keeps a valid session in sessionStorage (not localStorage) and returns the token', () => {
    const s = session(Date.now() + 60_000)
    tokenStore.set(s)
    expect(tokenStore.get()?.user.username).toBe('asha')
    expect(tokenStore.getToken()).toBe(s.token)
    expect(localStorage.length).toBe(0)
  })

  it('drops an expired session', () => {
    tokenStore.set(session(Date.now() - 1))
    expect(tokenStore.get()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('ignores corrupt data and can be cleared', () => {
    sessionStorage.setItem('resqnet.session', '{not json')
    expect(tokenStore.get()).toBeNull()
    tokenStore.set(session(Date.now() + 60_000))
    tokenStore.clear()
    expect(tokenStore.get()).toBeNull()
  })
})

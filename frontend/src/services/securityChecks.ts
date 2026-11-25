import axios from 'axios'
import { tokenStore } from './tokenStore'

/**
 * Live security demonstration. Each check sends ONE real request through the gateway and reports the HTTP status the
 * backend really answered with. Nothing is simulated. The requests use their own Axios instance, so the normal
 * interceptors (which add the session token and sign the user out on 401) do not interfere with the experiment.
 * Tokens are only held in memory for the duration of a run; they are never logged, displayed or stored.
 */
const raw = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api', timeout: 15_000, validateStatus: () => true })

export interface Check {
  id: string
  title: string
  /** What is sent, in words, without any secret. */
  request: string
  expected: number
  group: 'anonymous' | 'admin' | 'reporter'
  /** Why this status proves the control works. */
  meaning: string
}

export interface CheckResult extends Check {
  actual: number | null
  code?: string
  passed: boolean
  error?: string
}

export const CHECKS: Check[] = [
  { id: 'no-token', group: 'anonymous', title: 'Protected API without a token', request: 'GET /api/incidents (no Authorization header)', expected: 401, meaning: 'The gateway rejects the request before any service sees it.' },
  { id: 'bad-token', group: 'anonymous', title: 'Protected API with an invalid token', request: 'GET /api/incidents with a made-up bearer token', expected: 401, meaning: 'A token that is not signed by the auth service is refused.' },
  { id: 'ops-no-token', group: 'anonymous', title: 'Operations API without a token', request: 'GET /api/ops/health (no Authorization header)', expected: 401, meaning: 'The administrator endpoints are protected too.' },
  { id: 'wrong-password', group: 'anonymous', title: 'Login with a wrong password', request: 'POST /api/auth/login for a user that does not exist', expected: 401, meaning: 'Unknown user and wrong password give the same answer, so usernames cannot be probed.' },
  { id: 'internal-hidden', group: 'anonymous', title: 'Internal endpoint from outside', request: 'POST /internal/responders/assign through the gateway', expected: 404, meaning: 'Service-to-service endpoints are not routed by the gateway at all.' },
  { id: 'me', group: 'admin', title: 'Own identity with the current token', request: 'GET /api/auth/me with your session token', expected: 200, meaning: 'A valid token is accepted.' },
  { id: 'ops-admin', group: 'admin', title: 'Administrator-only API as administrator', request: 'GET /api/ops/health with your session token', expected: 200, meaning: 'The ADMIN role opens the operations endpoints.' },
  { id: 'reporter-dispatch', group: 'reporter', title: 'Reporter tries to dispatch', request: 'POST /api/incidents/1/dispatch with a reporter token', expected: 403, meaning: 'Dispatch is an administrator operation; the incident service refuses a USER.' },
  { id: 'reporter-ops', group: 'reporter', title: 'Reporter opens the operations API', request: 'GET /api/ops/health with a reporter token', expected: 403, meaning: 'A valid token without the ADMIN role is not enough.' },
  { id: 'reporter-forged', group: 'reporter', title: 'Reporter forges an admin header', request: 'POST /api/incidents/1/dispatch with a reporter token and X-User-Role: ADMIN', expected: 403, meaning: 'The gateway deletes client-sent identity headers and sets them from the verified token.' },
]

export function evaluate(check: Check, actual: number | null): boolean {
  return actual === check.expected
}

interface Answer { status: number; code?: string }

async function send(method: 'GET' | 'POST', url: string, headers: Record<string, string> = {}, data?: unknown): Promise<Answer> {
  const response = await raw.request({ method, url, headers, data })
  const body = response.data as { code?: string } | undefined
  return { status: response.status, code: typeof body === 'object' && body !== null ? body.code : undefined }
}

function randomText(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')
}

/** Runs one check. `reporterToken` is needed for the reporter group. */
export async function runCheck(check: Check, reporterToken?: string): Promise<CheckResult> {
  try {
    let answer: Answer
    switch (check.id) {
      case 'no-token': answer = await send('GET', '/incidents'); break
      case 'bad-token': answer = await send('GET', '/incidents', { Authorization: `Bearer ${randomText(24)}.${randomText(24)}.${randomText(24)}` }); break
      case 'ops-no-token': answer = await send('GET', '/ops/health'); break
      case 'wrong-password': answer = await send('POST', '/auth/login', {}, { username: `nobody_${randomText(8)}`, password: randomText(16) }); break
      case 'internal-hidden': answer = await send('POST', `${window.location.origin}/internal/responders/assign`, {}, {}); break
      case 'me': answer = await send('GET', '/auth/me', { Authorization: `Bearer ${tokenStore.getToken() ?? ''}` }); break
      case 'ops-admin': answer = await send('GET', '/ops/health', { Authorization: `Bearer ${tokenStore.getToken() ?? ''}` }); break
      case 'reporter-dispatch': answer = await send('POST', '/incidents/1/dispatch', { Authorization: `Bearer ${reporterToken ?? ''}` }); break
      case 'reporter-ops': answer = await send('GET', '/ops/health', { Authorization: `Bearer ${reporterToken ?? ''}` }); break
      case 'reporter-forged': answer = await send('POST', '/incidents/1/dispatch', { Authorization: `Bearer ${reporterToken ?? ''}`, 'X-User-Role': 'ADMIN' }); break
      default: throw new Error('unknown check')
    }
    return { ...check, actual: answer.status, code: answer.code, passed: evaluate(check, answer.status) }
  } catch (e) {
    return { ...check, actual: null, passed: false, error: e instanceof Error ? e.message : 'request failed' }
  }
}

/**
 * Creates a throw-away reporter account (random name and password, role USER) and returns its token, to demonstrate
 * what a regular user is refused. The credentials are never shown or kept; only the token is returned, in memory.
 * Side effect: one extra user row in auth_db.
 */
export async function createTemporaryReporterToken(): Promise<string> {
  const username = `demo_${randomText(10)}`
  const password = `${randomText(12)}Aa1!`
  const reg = await raw.post('/auth/register', { username, password })
  if (reg.status !== 201) throw new Error(`could not create the temporary reporter (HTTP ${reg.status})`)
  const login = await raw.post('/auth/login', { username, password })
  const token = (login.data as { token?: string } | undefined)?.token
  if (login.status !== 200 || !token) throw new Error(`could not sign in the temporary reporter (HTTP ${login.status})`)
  return token
}

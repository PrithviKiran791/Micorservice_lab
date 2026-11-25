import type { Incident, Responder } from '../types/api'

/** Builds a valid Incident for tests; override only what the test cares about. */
export function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 1,
    type: 'MEDICAL',
    severity: 'MEDIUM',
    status: 'PENDING',
    description: 'test incident',
    locationText: 'test location',
    latitude: null,
    longitude: null,
    reportedBy: { userId: 2, username: 'asha' },
    assignedResponder: null,
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    resolvedAt: null,
    ...overrides,
  }
}

export function responder(overrides: Partial<Responder> = {}): Responder {
  return { id: 1, name: 'Ambulance Alpha', type: 'AMBULANCE', status: 'AVAILABLE', zone: 'North', currentIncidentId: null, ...overrides }
}

/** A JWT-shaped string with the given expiry (seconds since epoch). The signature is fake: the UI never verifies it. */
export function fakeJwt(expSeconds: number): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256' })}.${b64({ sub: '2', exp: expSeconds })}.signature`
}

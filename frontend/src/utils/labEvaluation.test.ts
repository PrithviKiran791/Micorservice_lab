import { describe, expect, it } from 'vitest'
import { incident } from '../test/fixtures'
import type { OpsHealth, OpsKubernetes, OpsTraffic } from '../types/ops'
import { liveChecks, statusOf, type LiveCheck, type LiveContext } from './labEvaluation'

const ok: LiveCheck = { label: 'a', ok: true, detail: '' }
const bad: LiveCheck = { label: 'b', ok: false, detail: '' }
const unknown: LiveCheck = { label: 'c', ok: null, detail: '' }

describe('statusOf (PASS needs recorded evidence and no failing or unreadable live check)', () => {
  it('passes with evidence and all live checks ok', () => {
    expect(statusOf([ok, ok], 2).status).toBe('PASS')
  })
  it('is PARTIAL when a live check fails although evidence exists', () => {
    expect(statusOf([ok, bad], 3).status).toBe('PARTIAL')
  })
  it('is PARTIAL when a live source cannot be read (unknown is never counted as ok)', () => {
    expect(statusOf([ok, unknown], 3).status).toBe('PARTIAL')
  })
  it('is PARTIAL when live checks pass but nothing was recorded', () => {
    expect(statusOf([ok], 0).status).toBe('PARTIAL')
  })
  it('is NOT VERIFIED without evidence and with a failing check, or with nothing at all', () => {
    expect(statusOf([bad], 0).status).toBe('NOT VERIFIED')
    expect(statusOf([], 0).status).toBe('NOT VERIFIED')
  })
  it('lets a criterion without live checks pass on recorded results, and says so', () => {
    const r = statusOf([], 4)
    expect(r.status).toBe('PASS')
    expect(r.basis).toContain('recorded')
  })
})

const emptyCtx: LiveContext = { health: null, resilience: null, traffic: null, k8s: null, incidents: null, anonymousRejected: null }

function health(overrides: Partial<OpsHealth> = {}): OpsHealth {
  const svc = (name: string, healthyInstances: number) => ({ name, status: healthyInstances > 0 ? ('UP' as const) : ('DOWN' as const), registeredInstances: healthyInstances, healthyInstances, lastHealthyAt: null, instances: [] })
  return {
    generatedAt: '', source: '',
    discovery: { health: 'UP', registryReadable: true, responseMs: 1, registeredApplications: [] },
    services: [svc('api-gateway', 2), svc('auth-service', 1), svc('incident-service', 2), svc('responder-service', 1), svc('notification-service', 1)],
    databases: ['auth_db', 'incident_db', 'responder_db', 'notification_db'].map((database) => ({ service: 'x', database, status: 'UP' as const })),
    rabbitmq: { status: 'UP', reportedBy: [] },
    ...overrides,
  }
}

describe('liveChecks', () => {
  it('reports unknown (null), never ok, when nothing could be read', () => {
    for (const id of ['deployment', 'traffic', 'database', 'communication', 'resilience', 'discovery'] as const) {
      expect(liveChecks(id, emptyCtx).every((c) => c.ok === null), id).toBe(true)
    }
  })

  it('discovery fails when a service has no healthy instance', () => {
    const h = health()
    h.services[3] = { ...h.services[3], healthyInstances: 0, registeredInstances: 0 }
    const checks = liveChecks('discovery', { ...emptyCtx, health: h })
    expect(checks[2].ok).toBe(false)
    expect(checks[2].detail).toContain('responder-service')
  })

  it('database requires all four databases UP and stored incidents', () => {
    const h = health()
    expect(liveChecks('database', { ...emptyCtx, health: h, incidents: [incident()] }).every((c) => c.ok === true)).toBe(true)
    h.databases[1] = { ...h.databases[1], status: 'DOWN' }
    expect(liveChecks('database', { ...emptyCtx, health: h, incidents: [incident()] })[0].ok).toBe(false)
    expect(liveChecks('database', { ...emptyCtx, health: health(), incidents: [] })[1].ok).toBe(false)
  })

  it('traffic needs counted requests on two pods, not just two pods', () => {
    const pod = (id: string, n: number) => ({ service: 'incident-service', instanceId: id, address: id, available: true, requests: { '/incidents': n, '/incidents/{id}': 0 } })
    const none: OpsTraffic = { generatedAt: '', registryReadable: true, instances: [pod('a', 0), pod('b', 0)] }
    const both: OpsTraffic = { generatedAt: '', registryReadable: true, instances: [pod('a', 5), pod('b', 4)] }
    expect(liveChecks('traffic', { ...emptyCtx, health: health(), traffic: none })[2].ok).toBe(false)
    expect(liveChecks('traffic', { ...emptyCtx, health: health(), traffic: both }).every((c) => c.ok === true)).toBe(true)
  })

  it('deployment needs every deployment ready and only the gateway as NodePort', () => {
    const k8s: OpsKubernetes = {
      generatedAt: '', namespace: 'resqnet', available: true,
      deployments: [{ name: 'a', desired: 2, ready: 2, available: 2, updated: 2, image: '' }, { name: 'b', desired: 1, ready: 0, available: 0, updated: 1, image: '' }],
      services: [{ name: 'api-gateway', type: 'NodePort', ports: [] }, { name: 'auth-service', type: 'ClusterIP', ports: [] }],
    }
    expect(liveChecks('deployment', { ...emptyCtx, k8s })[1].ok).toBe(false)
    expect(liveChecks('deployment', { ...emptyCtx, k8s })[2].ok).toBe(true)
    expect(liveChecks('deployment', { ...emptyCtx, k8s: { generatedAt: '', namespace: 'resqnet', available: false, reason: 'no token' } })[0].ok).toBe(false)
  })

  it('security reflects the anonymous probe', () => {
    expect(liveChecks('security', { ...emptyCtx, anonymousRejected: true })[0].ok).toBe(true)
    expect(liveChecks('security', { ...emptyCtx, anonymousRejected: false })[0].ok).toBe(false)
    expect(liveChecks('security', emptyCtx)[0].ok).toBeNull()
  })
})

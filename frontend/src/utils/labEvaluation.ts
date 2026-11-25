import type { Incident } from '../types/api'
import type { OpsHealth, OpsKubernetes, OpsResilience, OpsTraffic } from '../types/ops'
import { totalRequests } from './ops'

export type CriterionId = 'deployment' | 'traffic' | 'database' | 'communication' | 'resilience' | 'discovery' | 'security' | 'testing'
export type CriterionStatus = 'PASS' | 'PARTIAL' | 'NOT VERIFIED'

/** One thing that can be checked against the running system right now. `ok: null` = the source could not be read. */
export interface LiveCheck {
  label: string
  ok: boolean | null
  detail: string
}

export interface LiveContext {
  health: OpsHealth | null
  resilience: OpsResilience | null
  traffic: OpsTraffic | null
  k8s: OpsKubernetes | null
  incidents: Incident[] | null
  /** Result of the three anonymous security requests (all answered 401?), or null if not run yet. */
  anonymousRejected: boolean | null
}

const SERVICES = ['api-gateway', 'auth-service', 'incident-service', 'responder-service', 'notification-service']

function healthy(ctx: LiveContext, name: string): number | null {
  const s = ctx.health?.services.find((x) => x.name === name)
  return s ? s.healthyInstances : null
}

export function liveChecks(id: CriterionId, ctx: LiveContext): LiveCheck[] {
  const { health, k8s, traffic, resilience, incidents } = ctx
  switch (id) {
    case 'deployment': {
      const available = k8s ? k8s.available : null
      const deployments = k8s?.available ? (k8s.deployments ?? []) : []
      const allReady = deployments.length > 0 && deployments.every((d) => d.desired > 0 && d.ready >= d.desired)
      const nodePorts = k8s?.available ? (k8s.services ?? []).filter((s) => s.type === 'NodePort').map((s) => s.name) : []
      return [
        { label: 'Kubernetes API readable', ok: available, detail: k8s ? (k8s.available ? `namespace ${k8s.namespace}` : (k8s.reason ?? 'unavailable')) : 'not loaded' },
        { label: 'Every deployment has all replicas ready', ok: available ? allReady : null, detail: available ? `${deployments.filter((d) => d.ready >= d.desired && d.desired > 0).length} of ${deployments.length} deployments ready` : 'unknown' },
        { label: 'Only the API gateway is exposed as NodePort', ok: available ? nodePorts.length === 1 && nodePorts[0] === 'api-gateway' : null, detail: available ? `NodePort services: ${nodePorts.join(', ') || 'none'}` : 'unknown' },
      ]
    }
    case 'traffic': {
      const gw = healthy(ctx, 'api-gateway')
      const inc = healthy(ctx, 'incident-service')
      const pods = (traffic?.instances ?? []).filter((i) => i.service === 'incident-service' && i.available)
      const answering = pods.filter((p) => totalRequests(p.requests) > 0).length
      const anyCounted = pods.some((p) => totalRequests(p.requests) > 0)
      return [
        { label: 'At least 2 healthy API gateway replicas', ok: gw === null ? null : gw >= 2, detail: gw === null ? 'unknown' : `${gw} healthy` },
        { label: 'At least 2 healthy incident-service replicas', ok: inc === null ? null : inc >= 2, detail: inc === null ? 'unknown' : `${inc} healthy` },
        {
          label: 'Requests counted on at least 2 incident-service pods',
          ok: traffic === null ? null : answering >= 2,
          detail: traffic === null ? 'unknown' : anyCounted ? `${answering} pod(s) have answered requests since they started` : 'no requests counted yet: generate traffic and refresh',
        },
      ]
    }
    case 'database': {
      const dbs = health?.databases ?? null
      return [
        { label: 'All four databases report UP', ok: dbs === null ? null : dbs.length === 4 && dbs.every((d) => d.status === 'UP'), detail: dbs === null ? 'unknown' : dbs.map((d) => `${d.database}: ${d.status}`).join(', ') },
        { label: 'Incidents are stored in the database', ok: incidents === null ? null : incidents.length > 0, detail: incidents === null ? 'unknown' : `${incidents.length} incident(s) read back from incident_db` },
      ]
    }
    case 'communication': {
      const responder = health?.services.find((s) => s.name === 'responder-service')
      const assigned = incidents === null ? null : incidents.some((i) => i.assignedResponder !== null)
      return [
        { label: 'Responder Service (REST target) is UP', ok: responder ? responder.status === 'UP' : null, detail: responder ? responder.status : 'unknown' },
        { label: 'RabbitMQ is connected', ok: health ? health.rabbitmq.status === 'UP' : null, detail: health ? health.rabbitmq.status : 'unknown' },
        { label: 'An incident has been assigned a responder through the REST call', ok: assigned, detail: assigned === null ? 'unknown' : assigned ? 'at least one incident has an assigned responder' : 'no assigned incident yet' },
      ]
    }
    case 'resilience': {
      const breakers = resilience?.instances.filter((i) => i.available && Object.keys(i.circuitBreakers ?? {}).length > 0) ?? []
      return [
        { label: 'Circuit-breaker state is readable from the incident-service pods', ok: resilience === null ? null : breakers.length > 0, detail: resilience === null ? 'unknown' : breakers.length > 0 ? `${breakers.length} pod(s) report breaker ${[...new Set(breakers.flatMap((b) => Object.values(b.circuitBreakers ?? {}).map((c) => c.state)))].join('/')}` : 'no pod reports a breaker' },
      ]
    }
    case 'discovery': {
      const missing = health ? SERVICES.filter((n) => (healthy(ctx, n) ?? 0) < 1) : []
      return [
        { label: 'Discovery server is UP', ok: health ? health.discovery.health === 'UP' : null, detail: health ? String(health.discovery.health) : 'unknown' },
        { label: 'The gateway can read the registry', ok: health ? health.discovery.registryReadable : null, detail: health ? (health.discovery.registryReadable ? 'yes' : 'no') : 'unknown' },
        { label: 'Every service is registered with at least one healthy instance', ok: health ? missing.length === 0 : null, detail: health ? (missing.length === 0 ? 'all five services' : `missing: ${missing.join(', ')}`) : 'unknown' },
      ]
    }
    case 'security':
      return [{ label: 'Requests without a valid token are rejected with 401', ok: ctx.anonymousRejected, detail: ctx.anonymousRejected === null ? 'checking...' : ctx.anonymousRejected ? 'all three anonymous requests answered 401' : 'an anonymous request was NOT rejected' }]
    case 'testing':
      return []
  }
}

export interface StatusResult {
  status: CriterionStatus
  basis: string
}

/**
 * PASS needs recorded evidence AND no live check that fails or cannot be read (a criterion without live checks relies on
 * recorded results alone, and says so). Live checks alone give PARTIAL; nothing gives NOT VERIFIED. A configuration
 * file or source file never counts as evidence.
 */
export function statusOf(checks: LiveCheck[], evidenceItems: number): StatusResult {
  const hasEvidence = evidenceItems > 0
  const liveOk = checks.length === 0 ? null : checks.every((c) => c.ok === true)
  if (hasEvidence && checks.length === 0) return { status: 'PASS', basis: 'recorded test results only (nothing can be re-checked live)' }
  if (hasEvidence && liveOk) return { status: 'PASS', basis: 'live checks pass now and recorded results exist' }
  if (hasEvidence) return { status: 'PARTIAL', basis: 'recorded results exist, but a live check fails or cannot be read right now' }
  if (liveOk) return { status: 'PARTIAL', basis: 'live checks pass, but there is no recorded test run for this criterion' }
  return { status: 'NOT VERIFIED', basis: 'no recorded result and no passing live check' }
}

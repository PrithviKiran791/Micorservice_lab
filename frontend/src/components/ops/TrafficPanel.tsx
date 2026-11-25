import { Link } from 'react-router-dom'
import type { OpsHealth, OpsKubernetes, OpsTraffic } from '../../types/ops'
import { labelOf, podName, serviceByName, totalRequests } from '../../utils/ops'
import { Card } from '../common/Card'
import { SourceTag, StatusPill } from './StatusPill'

function Replicas({ name, health, k8s }: { name: string; health: OpsHealth; k8s: OpsKubernetes | null }) {
  const s = serviceByName(health, name)
  const d = k8s?.available ? k8s.deployments?.find((x) => x.name === name) : undefined
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-sm font-medium text-ink">{labelOf(name)}</p>
      <dl className="mt-2 space-y-1 text-xs text-mute">
        <div className="flex justify-between gap-2"><dt>Registered in Eureka</dt><dd className="tabular-nums text-ink">{s?.registeredInstances ?? '-'}</dd></div>
        <div className="flex justify-between gap-2"><dt>Healthy</dt><dd className="tabular-nums text-ink">{s?.healthyInstances ?? '-'}</dd></div>
        <div className="flex justify-between gap-2">
          <dt>Kubernetes replicas (ready / desired)</dt>
          <dd className="tabular-nums text-ink">{d ? `${d.ready} / ${d.desired}` : 'unavailable'}</dd>
        </div>
      </dl>
    </div>
  )
}

/** D. Replicas, registered endpoints and measured request distribution across the incident-service pods. */
export function TrafficPanel({ health, traffic, k8s }: { health: OpsHealth; traffic: OpsTraffic | null; k8s: OpsKubernetes | null }) {
  const incidentPods = (traffic?.instances ?? []).filter((i) => i.service === 'incident-service' && i.available)
  const total = incidentPods.reduce((n, p) => n + totalRequests(p.requests), 0)
  const registered = health.services.filter((s) => ['api-gateway', 'incident-service'].includes(s.name)).flatMap((s) => s.instances.map((i) => ({ service: s.name, ...i })))

  return (
    <Card
      title="API gateway and load balancing"
      subtitle="The gateway looks up the incident service in Eureka and spreads requests over its pods (round-robin)."
      actions={<SourceTag kind="live" />}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Replicas name="api-gateway" health={health} k8s={k8s} />
        <Replicas name="incident-service" health={health} k8s={k8s} />
      </div>

      <h3 className="mt-5 text-sm font-semibold text-ink">Registered endpoints</h3>
      <ul className="mt-2 space-y-1 text-xs text-mute">
        {registered.map((i) => (
          <li key={i.instanceId} className="flex flex-wrap items-center gap-x-2">
            <span className="w-32 text-faint">{labelOf(i.service)}</span>
            <span className="font-medium text-ink">{i.address}</span>
            <span className="text-faint">{podName(i.instanceId)}</span>
            <StatusPill state={String(i.health)} />
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-sm font-semibold text-ink">Requests answered by each incident-service pod</h3>
      {incidentPods.length === 0 ? (
        <p className="mt-2 text-sm text-amber">No incident-service pod answered the metrics request, so no distribution can be shown.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-3">
            {incidentPods.map((p) => {
              const n = totalRequests(p.requests)
              const share = total > 0 ? Math.round((n / total) * 100) : 0
              return (
                <li key={p.instanceId}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium text-ink">{podName(p.instanceId)}</span>
                    <span className="tabular-nums text-mute">{n} requests{total > 0 ? ` (${share}%)` : ''}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel-2" role="img" aria-label={`${share} percent of requests`}>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          {total === 0 ? (
            <p className="mt-3 text-xs text-amber">No incident requests have been counted yet since these pods started. Generate traffic (report incidents or run the load test) and refresh.</p>
          ) : (
            <p className="mt-3 text-xs text-faint">
              Counts come from each pod's own request counter for the incident endpoints, since that pod started. A roughly even split is the evidence of load balancing; a pod that was restarted recently starts from zero.
            </p>
          )}
        </>
      )}

      <p className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-xs text-mute">
        <span className="font-medium text-ink">Limitation:</span> the gateway itself does not publish per-route request counters, so the distribution is measured at the pods. The smallest addition would be to expose the gateway's Micrometer metrics in the same way. A recorded load test with 1,500 requests is on the <Link to="/app/lab" className="text-brand hover:underline">Lab Evaluation</Link> page.
      </p>
    </Card>
  )
}

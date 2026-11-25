import { Database, Radio } from 'lucide-react'
import type { OpsHealth } from '../../types/ops'
import { timeAgo } from '../../utils/format'
import { labelOf, podName } from '../../utils/ops'
import { Card } from '../common/Card'
import { SourceTag, StatusPill } from './StatusPill'

export const SHOWN_SERVICES = ['api-gateway', 'auth-service', 'incident-service', 'responder-service', 'notification-service']

/** B. One row per microservice: real health of every registered instance, not "the page loaded". */
export function HealthMonitor({ health }: { health: OpsHealth }) {
  const discoveryUp = health.discovery.health === 'UP'
  return (
    <Card
      title="Microservices health monitor"
      subtitle="Every instance registered in Eureka is asked for its own /actuator/health when this page refreshes."
      actions={<SourceTag kind="live" />}
      padded={false}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-faint">
            <tr>
              <th className="px-5 py-3 font-medium">Service</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Instances</th>
              <th className="px-3 py-3 font-medium">Last healthy check</th>
              <th className="px-5 py-3 font-medium">Pods and answers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {SHOWN_SERVICES.map((name) => {
              const s = health.services.find((x) => x.name === name)
              if (!s) return null
              return (
                <tr key={name} className="align-top">
                  <td className="px-5 py-3 font-medium text-ink">{labelOf(name)}</td>
                  <td className="px-3 py-3">
                    <StatusPill state={s.status} />
                    {s.reason && <p className="mt-1 max-w-[220px] text-xs text-faint">{s.reason}</p>}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-mute">
                    {s.healthyInstances} healthy / {s.registeredInstances} registered
                  </td>
                  <td className="px-3 py-3 text-mute">{s.lastHealthyAt ? timeAgo(s.lastHealthyAt) : 'never seen healthy by the gateway'}</td>
                  <td className="px-5 py-3">
                    <ul className="space-y-0.5 text-xs text-mute">
                      {s.instances.map((i) => (
                        <li key={i.instanceId} className="flex flex-wrap items-center gap-x-2">
                          <span className="font-medium text-ink">{podName(i.instanceId)}</span>
                          <StatusPill state={String(i.health)} />
                          <span className="text-faint">{i.responseMs} ms</span>
                        </li>
                      ))}
                      {s.instances.length === 0 && <li className="text-faint">no pods</li>}
                    </ul>
                  </td>
                </tr>
              )
            })}
            <tr className="align-top">
              <td className="px-5 py-3 font-medium text-ink">{labelOf('discovery-service')}</td>
              <td className="px-3 py-3">
                <StatusPill state={discoveryUp ? 'UP' : 'DOWN'}>{discoveryUp ? 'UP' : String(health.discovery.health)}</StatusPill>
              </td>
              <td className="px-3 py-3 text-mute">Not registered: it is the registry, probed directly</td>
              <td className="px-3 py-3 text-mute">{discoveryUp ? 'just now (this refresh)' : 'not answering'}</td>
              <td className="px-5 py-3 text-xs text-faint">{health.discovery.responseMs} ms</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** C. What the registry knows. The registry's own health and the registrations of the other services are shown separately on purpose. */
export function DiscoveryPanel({ health }: { health: OpsHealth }) {
  const d = health.discovery
  return (
    <Card
      title="Service discovery (Eureka)"
      subtitle="Services register themselves and renew every 5 s. The gateway and the incident service find other services here."
      actions={<SourceTag kind="live" />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-3">
          <p className="text-xs uppercase tracking-wide text-faint">Discovery server (process)</p>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusPill state={d.health === 'UP' ? 'UP' : 'DOWN'}>{String(d.health)}</StatusPill>
            <span className="text-xs text-faint">{d.responseMs} ms</span>
          </div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-xs uppercase tracking-wide text-faint">Registry readable by the gateway</p>
          <div className="mt-1.5">
            <StatusPill state={d.registryReadable ? 'UP' : 'DOWN'}>{d.registryReadable ? 'YES' : 'NO'}</StatusPill>
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-mute">The server being up and the services being registered are different facts: the table below is what is registered right now.</p>
      {d.registeredApplications.length === 0 ? (
        <p className="mt-3 text-sm text-amber">
          {d.registryReadable ? 'The registry is readable but holds no registrations.' : 'The registry could not be read, so registrations are unknown.'}
        </p>
      ) : (
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-faint">
            <tr>
              <th className="py-2 font-medium">Application</th>
              <th className="py-2 font-medium">Instances</th>
              <th className="py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {d.registeredApplications.map((a) => (
              <tr key={a.name}>
                <td className="py-2 text-ink">{a.name}</td>
                <td className="py-2 tabular-nums text-mute">{a.instances}</td>
                <td className="py-2">
                  <StatusPill state={a.up === a.instances ? 'UP' : a.up > 0 ? 'DEGRADED' : 'DOWN'}>
                    {a.up} of {a.instances} UP
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

/** E. Database-per-service. Status is each service's own "db" health check; no performance numbers are invented. */
export function DatabasePanel({ health }: { health: OpsHealth }) {
  const anyUp = health.databases.some((d) => d.status === 'UP')
  return (
    <Card
      title="Databases (PostgreSQL)"
      subtitle="One PostgreSQL server, four separate databases and four separate users. A service cannot open another service's database."
      actions={<SourceTag kind="live" note="Status = the db health check of each service, which tests that service's own connection" />}
    >
      <div className="mb-4 flex items-center gap-2 text-sm text-mute">
        <Database className="h-4 w-4" aria-hidden="true" /> PostgreSQL reachable by at least one service:
        <StatusPill state={anyUp ? 'UP' : 'UNKNOWN'}>{anyUp ? 'YES' : 'UNKNOWN'}</StatusPill>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {health.databases.map((d) => (
          <li key={d.database} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-ink">{d.database}</span>
              <StatusPill state={d.status} />
            </div>
            <p className="mt-1 text-xs text-mute">owned by {labelOf(d.service)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-faint">
        Shown: connectivity only. Query times, connection counts and sizes are not measured by the current system, so they are not shown.
      </p>
    </Card>
  )
}

/** F. RabbitMQ and the event flow. Connectivity is reported by the two services that use the broker. */
export function BrokerPanel({ health }: { health: OpsHealth }) {
  const steps = ['Incident Service', 'RabbitMQ exchange', 'Notification Service', 'User notification centre']
  return (
    <Card
      title="RabbitMQ and asynchronous events"
      subtitle="An incident event is published after the incident is saved; the notification service consumes it independently."
      actions={<SourceTag kind="live" />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-mute">
        <Radio className="h-4 w-4" aria-hidden="true" /> Broker connectivity as seen by the services that use it: <StatusPill state={health.rabbitmq.status} />
      </div>
      <ol className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className="rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-ink">{s}</span>
            {i < steps.length - 1 && <span className="text-faint" aria-hidden="true">- - &gt;</span>}
          </li>
        ))}
      </ol>
      <ul className="space-y-2 text-sm">
        {health.rabbitmq.reportedBy.map((c) => (
          <li key={c.service} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
            <span>
              <span className="font-medium text-ink">{labelOf(c.service)}</span> <span className="text-xs text-mute">{c.role}</span>
            </span>
            <StatusPill state={c.status} />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-faint">
        Not measured: message rates and queue depth (the system does not expose them and the RabbitMQ management interface stays private). The result of the flow is visible in the Notifications page.
      </p>
    </Card>
  )
}

/** Compact one-line-per-service summary for the overview page. */
export function HealthStrip({ health }: { health: OpsHealth }) {
  const items = [
    ...SHOWN_SERVICES.map((n) => ({ name: n, state: health.services.find((s) => s.name === n)?.status ?? 'UNKNOWN' })),
    { name: 'discovery-service', state: health.discovery.health === 'UP' ? 'UP' : 'DOWN' },
  ]
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((i) => (
        <li key={i.name} className="rounded-lg border border-line bg-panel-2 px-3 py-2">
          <p className="truncate text-xs text-mute">{labelOf(i.name)}</p>
          <div className="mt-1">
            <StatusPill state={i.state} />
          </div>
        </li>
      ))}
    </ul>
  )
}

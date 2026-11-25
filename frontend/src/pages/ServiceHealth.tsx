import { Activity } from 'lucide-react'
import { Card } from '../components/common/Card'
import { LiveStatus, PageHeader } from '../components/common/PageHeader'
import { ErrorState, InlineNotice, LoadingState } from '../components/common/States'
import { BrokerPanel, DatabasePanel, DiscoveryPanel, HealthMonitor } from '../components/ops/HealthPanels'
import { KubernetesPanel } from '../components/ops/KubernetesPanel'
import { ResiliencePanel } from '../components/ops/ResiliencePanel'
import { TrafficPanel } from '../components/ops/TrafficPanel'
import { useResource } from '../hooks/useResource'
import { incidentService } from '../services/incidentService'
import { opsService } from '../services/opsService'
import type { Incident } from '../types/api'
import type { OpsHealth, OpsKubernetes, OpsResilience, OpsTraffic } from '../types/ops'

const SECTIONS = [
  ['services', 'Health'],
  ['discovery', 'Discovery'],
  ['traffic', 'Load balancing'],
  ['databases', 'Databases'],
  ['broker', 'RabbitMQ'],
  ['resilience', 'Resilience'],
  ['kubernetes', 'Kubernetes'],
] as const

/**
 * The command center's infrastructure view (administrators only). Every panel is read from the operations API of the
 * gateway; a panel whose source cannot be read says so instead of showing a made-up value.
 */
export default function ServiceHealth() {
  const health = useResource<OpsHealth>((s) => opsService.health(s))
  const resilience = useResource<OpsResilience>((s) => opsService.resilience(s))
  const traffic = useResource<OpsTraffic>((s) => opsService.traffic(s))
  const k8s = useResource<OpsKubernetes>((s) => opsService.kubernetes(s))
  const incidents = useResource<Incident[]>((s) => incidentService.list(undefined, s))

  const pending = incidents.data ? incidents.data.filter((i) => i.status === 'PENDING').length : null
  const assigned = incidents.data ? incidents.data.filter((i) => i.status === 'ASSIGNED').length : null

  return (
    <>
      <PageHeader
        title="Service health"
        subtitle="Live state of every microservice and of the infrastructure behind them."
        actions={<LiveStatus resource={health} />}
      />

      <nav aria-label="Sections" className="-mt-2 mb-6 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-line px-3 py-1 text-xs text-mute transition-colors hover:border-faint hover:text-ink">{label}</a>
        ))}
      </nav>

      {health.loading ? (
        <Card><LoadingState label="Checking every service..." /></Card>
      ) : health.error && !health.data ? (
        <Card><ErrorState error={health.error} onRetry={() => void health.reload()} title="The operations API did not answer" /></Card>
      ) : health.data ? (
        <div className="space-y-6">
          {health.error && <InlineNotice title="Showing the last known data">{health.error.message}</InlineNotice>}

          <section id="services" className="scroll-mt-20"><HealthMonitor health={health.data} /></section>
          <section id="discovery" className="scroll-mt-20"><DiscoveryPanel health={health.data} /></section>
          <section id="traffic" className="scroll-mt-20">
            <TrafficPanel health={health.data} traffic={traffic.data} k8s={k8s.data} />
          </section>
          <section id="databases" className="scroll-mt-20"><DatabasePanel health={health.data} /></section>
          <section id="broker" className="scroll-mt-20"><BrokerPanel health={health.data} /></section>
          <section id="resilience" className="scroll-mt-20">
            <ResiliencePanel health={health.data} resilience={resilience.data} pending={pending} assigned={assigned} />
          </section>
          <section id="kubernetes" className="scroll-mt-20">
            {k8s.data ? <KubernetesPanel k8s={k8s.data} /> : <Card title="Kubernetes deployment">{k8s.loading ? <LoadingState /> : k8s.error ? <ErrorState error={k8s.error} onRetry={() => void k8s.reload()} /> : null}</Card>}
          </section>

          <p className="flex items-center gap-2 text-xs text-faint">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" /> {health.data.source}. Refresh interval: see Settings.
          </p>
        </div>
      ) : null}
    </>
  )
}

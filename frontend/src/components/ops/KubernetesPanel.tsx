import type { OpsKubernetes } from '../../types/ops'
import { timeAgo } from '../../utils/format'
import { Card } from '../common/Card'
import { SourceTag, StatusPill } from './StatusPill'

/**
 * Deployment visibility: deployments, replica counts, pod status and how services are exposed. Read by the gateway through
 * the Kubernetes API with a read-only service account; the browser never talks to the cluster.
 */
export function KubernetesPanel({ k8s }: { k8s: OpsKubernetes }) {
  if (!k8s.available) {
    return (
      <Card title="Kubernetes deployment" actions={<SourceTag kind="unavailable" />}>
        <p className="text-sm text-amber">The cluster state could not be read: {k8s.reason ?? 'unknown reason'}</p>
        <p className="mt-2 text-xs text-faint">Nothing is shown instead of guessing. Check the namespace manually with: kubectl -n resqnet get deploy,pods,svc</p>
      </Card>
    )
  }
  const deployments = k8s.deployments ?? []
  const pods = (k8s.pods ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
  const services = k8s.services ?? []
  const allReady = deployments.length > 0 && deployments.every((d) => d.ready >= d.desired && d.desired > 0)

  return (
    <Card
      title={`Kubernetes deployment (namespace ${k8s.namespace})`}
      subtitle="Read live from the Kubernetes API by the gateway with a read-only service account."
      actions={
        <>
          <StatusPill state={allReady ? 'UP' : 'DEGRADED'}>{allReady ? 'ALL DEPLOYMENTS READY' : 'NOT ALL READY'}</StatusPill>
          <SourceTag kind="live" />
        </>
      }
    >
      <h3 className="text-sm font-semibold text-ink">Deployments</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-faint">
            <tr><th className="py-2 font-medium">Deployment</th><th className="py-2 font-medium">Ready / desired</th><th className="py-2 font-medium">Image</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {deployments.map((d) => (
              <tr key={d.name}>
                <td className="py-2 font-medium text-ink">{d.name}</td>
                <td className="py-2"><StatusPill state={d.ready >= d.desired && d.desired > 0 ? 'UP' : d.ready > 0 ? 'DEGRADED' : 'DOWN'}>{d.ready} / {d.desired}</StatusPill></td>
                <td className="py-2 text-xs text-mute">{d.image}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-5 text-sm font-semibold text-ink">Pods ({pods.length})</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-faint">
            <tr><th className="py-2 font-medium">Pod</th><th className="py-2 font-medium">Phase</th><th className="py-2 font-medium">Ready</th><th className="py-2 font-medium">Restarts</th><th className="py-2 font-medium">Started</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pods.map((p) => (
              <tr key={p.name}>
                <td className="py-2 text-xs font-medium text-ink">{p.name}{p.terminating ? ' (terminating)' : ''}</td>
                <td className="py-2 text-xs text-mute">{p.phase}</td>
                <td className="py-2"><StatusPill state={p.ready ? 'UP' : 'DOWN'}>{p.ready ? 'READY' : 'NOT READY'}</StatusPill></td>
                <td className="py-2 tabular-nums text-xs text-mute">{p.restarts}</td>
                <td className="py-2 text-xs text-mute">{p.startedAt ? timeAgo(p.startedAt) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-5 text-sm font-semibold text-ink">Service exposure</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {services.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs">
            <span className="font-medium text-ink">{s.name}</span>
            <span className="text-mute">{s.type} · {s.ports.map((p) => (p.nodePort ? `${p.port}:${p.nodePort}` : p.port)).join(', ')}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-faint">Only the API gateway is a NodePort (the single entry point); every other service is ClusterIP, reachable only inside the cluster.</p>
    </Card>
  )
}

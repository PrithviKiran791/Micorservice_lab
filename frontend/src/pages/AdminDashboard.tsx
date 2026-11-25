import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, CheckCircle2, ClipboardList, Clock3, Send, Truck, UserCheck } from 'lucide-react'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { LiveStatus, PageHeader } from '../components/common/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { EmptyState, ErrorState, InlineNotice, LoadingState } from '../components/common/States'
import { ConfirmDialog } from '../components/common/Modal'
import { IncidentDetailLoader } from '../components/incidents/IncidentDetailLoader'
import { HealthStrip } from '../components/ops/HealthPanels'
import { SourceTag } from '../components/ops/StatusPill'
import { IncidentTable } from '../components/incidents/IncidentTable'
import { AvailabilitySummary } from '../components/responders/AvailabilitySummary'
import { useToast } from '../contexts/ToastContext'
import { useIncidentActions } from '../hooks/useIncidentActions'
import { useResource } from '../hooks/useResource'
import { incidentService } from '../services/incidentService'
import { opsService } from '../services/opsService'
import { responderService } from '../services/responderService'
import type { Incident, Responder } from '../types/api'
import type { OpsHealth } from '../types/ops'
import { timeAgo } from '../utils/format'
import { responderAvailability, summarize } from '../utils/stats'

/** The dispatcher's operations view: queue of pending incidents, incident management, responders and key numbers. */
export default function AdminDashboard() {
  const incidents = useResource<Incident[]>((signal) => incidentService.list(undefined, signal))
  const responders = useResource<Responder[]>((signal) => responderService.list(undefined, signal))
  const ops = useResource<OpsHealth>((signal) => opsService.health(signal))
  const { notify } = useToast()
  const [refreshToken, setRefreshToken] = useState(0)
  const { dialog, buttonsFor } = useIncidentActions(() => {
    void incidents.reload()
    setRefreshToken((n) => n + 1)
  })

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [dispatching, setDispatching] = useState(false)

  const list = incidents.data ?? []
  const summary = summarize(list)
  const loaded = incidents.data !== null
  const v = (n: number): string | number => (loaded ? n : '-')

  // oldest first: the longest-waiting incident should be dispatched first
  const queue = useMemo(() => list.filter((i) => i.status === 'PENDING').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [list])
  const recent = list.slice(0, 8)
  
  const availability = responders.data ? responderAvailability(responders.data) : null
  const incidentById = useMemo(() => new Map(list.map((i) => [i.id, i])), [list])
  const busyResponders = (responders.data ?? []).filter((r) => r.status === 'BUSY')

  const resolvedShare = summary.total > 0 ? Math.round((summary.resolved / summary.total) * 100) : 0
  const last24h = list.filter((i) => Date.now() - new Date(i.createdAt).getTime() <= 24 * 3_600_000).length

  /** Tries to dispatch every pending incident, one after the other, and reports the outcome. */
  async function dispatchAll() {
    setDispatching(true)
    let assigned = 0
    let stillPending = 0
    let failed = 0
    for (const incident of queue) {
      try {
        const result = await incidentService.dispatch(incident.id)
        if (result.status === 'ASSIGNED') assigned++
        else stillPending++
      } catch {
        failed++
      }
    }
    setDispatching(false)
    setConfirmAll(false)
    await Promise.all([incidents.reload(), responders.reload()])
    notify(failed > 0 ? 'warning' : assigned > 0 ? 'success' : 'info', 'Dispatch finished', `${assigned} assigned, ${stillPending} still pending${failed > 0 ? `, ${failed} failed` : ''}.`)
  }

  return (
    <>
      <PageHeader title="Operations overview" subtitle="Incident queue, dispatch, responder availability and platform health." actions={<LiveStatus resource={incidents} />} />

      {responders.error && (
        <div className="mb-6">
          <InlineNotice title={responders.error.status === 503 ? 'Responder service unavailable' : 'Responder data could not be loaded'}>
            {responders.error.status === 503
              ? 'New incidents are still accepted and wait as pending. Dispatch and resolve will work again as soon as the responder service is back.'
              : responders.error.message}
          </InlineNotice>
        </div>
      )}

      {incidents.error && !incidents.data && (
        <Card className="mb-6"><ErrorState error={incidents.error} onRetry={() => void incidents.reload()} title="Could not load incidents" /></Card>
      )}

      <Card className="mb-6" title="Platform health" subtitle="Real health of every service, read by the gateway" actions={<><SourceTag kind="live" /><Link to="/app/health" className="text-sm font-medium text-brand hover:underline">Service health</Link></>}>
        {ops.data ? <HealthStrip health={ops.data} /> : ops.error ? <p className="text-sm text-amber">Health could not be read: {ops.error.message}</p> : <p className="text-sm text-mute">Checking services...</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total incidents" value={v(summary.total)} icon={ClipboardList} />
        <StatCard label="Pending queue" value={v(summary.pending)} icon={Clock3} tone="amber" />
        <StatCard label="Assigned" value={v(summary.assigned)} icon={UserCheck} tone="ok" />
        <StatCard label="Resolved" value={v(summary.resolved)} icon={CheckCircle2} />
        <StatCard label="Critical, open" value={v(summary.openCritical)} icon={AlertOctagon} tone={summary.openCritical > 0 ? 'critical' : 'neutral'} />
        <StatCard label="Total responders" value={availability ? availability.total : '-'} icon={Truck} hint={availability ? undefined : 'Unavailable, not zero'} />
        <StatCard label="Available responders" value={availability ? availability.byStatus.AVAILABLE : '-'} icon={UserCheck} tone="ok" hint={availability ? undefined : 'Unavailable, not zero'} />
        <StatCard label="Busy responders" value={availability ? availability.byStatus.BUSY : '-'} icon={Truck} tone="amber" hint={availability ? undefined : 'Unavailable, not zero'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card
          title="Pending queue"
          subtitle="Oldest first. Dispatch retries the responder assignment."
          actions={queue.length > 1 ? <Button size="sm" icon={Send} onClick={() => setConfirmAll(true)}>Dispatch all ({queue.length})</Button> : undefined}
          padded={false}
        >
          {incidents.loading ? (
            <LoadingState label="Loading queue..." />
          ) : queue.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="The queue is empty" message="Every incident has been assigned. New incidents without a free responder appear here." />
          ) : (
            <IncidentTable incidents={queue} onSelect={(i) => setSelectedId(i.id)} showReporter renderActions={buttonsFor} />
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Operational snapshot" subtitle="Calculated from the incidents loaded here">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-mute">Oldest pending</dt><dd className="font-medium text-ink">{queue.length > 0 ? timeAgo(queue[0].createdAt) : 'none waiting'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Reported in the last 24 h</dt><dd className="font-medium text-ink">{loaded ? last24h : '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Resolved share</dt><dd className="font-medium text-ink">{loaded ? `${resolvedShare}%` : '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Responders busy</dt><dd className="font-medium text-ink">{availability ? availability.byStatus.BUSY : '-'}</dd></div>
            </dl>
          </Card>

          <Card title="Responder availability" actions={<Link to="/app/responders" className="text-sm font-medium text-brand hover:underline">Details</Link>}>
            {responders.loading ? (
              <LoadingState label="Loading responders..." />
            ) : responders.data ? (
              <AvailabilitySummary responders={responders.data} />
            ) : (
              <p className="text-sm text-mute">Responder data is unavailable right now.</p>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Incident management" subtitle="Latest 8 incidents" actions={<Link to="/app/incidents" className="text-sm font-medium text-brand hover:underline">View all</Link>} padded={false}>
          {incidents.loading ? (
            <LoadingState label="Loading incidents..." />
          ) : recent.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No incidents yet" message="Incidents appear here as soon as someone reports one." />
          ) : (
            <IncidentTable incidents={recent} onSelect={(i) => setSelectedId(i.id)} showReporter renderActions={buttonsFor} />
          )}
        </Card>

        <Card title="Current assignments" subtitle="Busy responders and their incidents">
          {busyResponders.length === 0 ? (
            <p className="text-sm text-mute">{responders.data ? 'No responder is busy.' : 'Responder data is unavailable.'}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {busyResponders.map((r) => {
                const inc = r.currentIncidentId !== null ? incidentById.get(r.currentIncidentId) : undefined
                return (
                  <li key={r.id} className="rounded-lg border border-line bg-night px-3 py-2.5">
                    <p className="font-medium text-ink">{r.name}</p>
                    <p className="text-xs text-mute">
                      <Link to={`/app/incidents?open=${r.currentIncidentId}`} className="font-medium text-brand hover:underline">Incident #{r.currentIncidentId}</Link>
                      {inc ? ` · ${inc.description.slice(0, 48)}${inc.description.length > 48 ? '...' : ''}` : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {selectedId !== null && <IncidentDetailLoader key={selectedId} id={selectedId} fallback={list.find((i) => i.id === selectedId)} onClose={() => setSelectedId(null)} refreshToken={refreshToken} footer={buttonsFor} />}
      {dialog}
      {confirmAll && (
        <ConfirmDialog
          title={`Dispatch all ${queue.length} pending incidents?`}
          message="The system will try to assign a responder to each pending incident, oldest first. Incidents without a matching free responder stay pending."
          confirmLabel="Dispatch all"
          loading={dispatching}
          onConfirm={() => void dispatchAll()}
          onCancel={() => !dispatching && setConfirmAll(false)}
        />
      )}
    </>
  )
}

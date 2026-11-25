import { useMemo, useState } from 'react'
import { CircleSlash, Truck, UserCheck, Wrench } from 'lucide-react'
import { Card } from '../components/common/Card'
import { SelectInput } from '../components/common/FormField'
import { LiveStatus, PageHeader } from '../components/common/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { EmptyState, ErrorState, InlineNotice, LoadingState } from '../components/common/States'
import { AvailabilitySummary } from '../components/responders/AvailabilitySummary'
import { ResponderCard } from '../components/responders/ResponderCard'
import { ResponderDetail } from '../components/responders/ResponderDetail'
import { useAuth } from '../contexts/AuthContext'
import { useResource } from '../hooks/useResource'
import { incidentService } from '../services/incidentService'
import { responderService } from '../services/responderService'
import { RESPONDER_STATUSES, RESPONDER_TYPES, type Incident, type Responder, type ResponderStatus, type ResponderType } from '../types/api'
import { RESPONDER_STATUS_LABEL, RESPONDER_TYPE_LABEL } from '../utils/format'
import { responderAvailability } from '../utils/stats'

/** Responder overview. Read-only: the backend can list responders but not create or change them. */
export default function Responders() {
  const { isAdmin } = useAuth()
  const responders = useResource<Responder[]>((signal) => responderService.list(undefined, signal))
  // a dispatcher can see which incident each busy responder is handling
  const incidents = useResource<Incident[]>((signal) => incidentService.list(undefined, signal), { enabled: isAdmin })
  const [type, setType] = useState<ResponderType | ''>('')
  const [status, setStatus] = useState<ResponderStatus | ''>('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const list = responders.data ?? []
  const incidentById = useMemo(() => new Map((incidents.data ?? []).map((i) => [i.id, i])), [incidents.data])
  const filtered = list.filter((r) => (!type || r.type === type) && (!status || r.status === status))
  const a = responderAvailability(list)
  const loaded = responders.data !== null

  return (
    <>
      <PageHeader title="Responders" subtitle="Ambulances, fire trucks and police units and their availability." actions={<LiveStatus resource={responders} />} />

      {responders.error && responders.data && (
        <div className="mb-6"><InlineNotice title="Showing the last known data">{responders.error.message}</InlineNotice></div>
      )}

      {responders.loading ? (
        <Card><LoadingState label="Loading responders..." /></Card>
      ) : responders.error && !responders.data ? (
        <Card>
          <ErrorState error={responders.error} onRetry={() => void responders.reload()} title={responders.error.status === 503 ? 'Responder service unavailable' : 'Could not load responders'} />
          {responders.error.status === 503 && (
            <p className="mx-auto mb-8 max-w-md px-4 text-center text-xs text-faint">
              This is expected while the responder service is down. New incidents are still accepted and wait as pending; login, incidents and notifications keep working.
            </p>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total responders" value={loaded ? a.total : '-'} icon={Truck} />
            <StatCard label="Available" value={loaded ? a.byStatus.AVAILABLE : '-'} icon={UserCheck} tone="ok" />
            <StatCard label="Busy" value={loaded ? a.byStatus.BUSY : '-'} icon={Wrench} tone="amber" />
            <StatCard label="Offline" value={loaded ? a.byStatus.OFFLINE : '-'} icon={CircleSlash} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_2fr]">
            <Card title="Availability by type">
              <AvailabilitySummary responders={list} />
            </Card>

            <Card
              title="All responders"
              actions={
                <div className="flex gap-2">
                  <SelectInput id="rtype" label="Type" value={type} onChange={(e) => setType(e.target.value as ResponderType | '')} className="h-9">
                    <option value="">All types</option>
                    {RESPONDER_TYPES.map((t) => (<option key={t} value={t}>{RESPONDER_TYPE_LABEL[t]}</option>))}
                  </SelectInput>
                  <SelectInput id="rstatus" label="Status" value={status} onChange={(e) => setStatus(e.target.value as ResponderStatus | '')} className="h-9">
                    <option value="">All</option>
                    {RESPONDER_STATUSES.map((s) => (<option key={s} value={s}>{RESPONDER_STATUS_LABEL[s]}</option>))}
                  </SelectInput>
                </div>
              }
            >
              {filtered.length === 0 ? (
                <EmptyState icon={Truck} title="No responders match" message="Change the type or status filter." />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((r) => (
                    <ResponderCard key={r.id} responder={r} onSelect={() => setSelectedId(r.id)} incident={r.currentIncidentId !== null ? incidentById.get(r.currentIncidentId) : undefined} />
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <p className="mt-4 text-xs text-faint">
            Responder data is read-only: the backend does not offer endpoints to add responders or change their availability. A responder becomes busy when it is assigned to an incident and available again when that incident is resolved.
            {isAdmin ? '' : ' Incident details are shown to dispatchers only.'}
          </p>
        </>
      )}
      {selectedId !== null && <ResponderDetail key={selectedId} id={selectedId} fallback={list.find((r) => r.id === selectedId)} onClose={() => setSelectedId(null)} />}
    </>
  )
}

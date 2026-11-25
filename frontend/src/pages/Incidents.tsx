import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClipboardList, Plus, Search } from 'lucide-react'
import { Card } from '../components/common/Card'
import { SelectInput, TextInput } from '../components/common/FormField'
import { LiveStatus, PageHeader } from '../components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { IncidentDetail } from '../components/incidents/IncidentDetail'
import { IncidentTable } from '../components/incidents/IncidentTable'
import { useAuth } from '../contexts/AuthContext'
import { useIncidentActions } from '../hooks/useIncidentActions'
import { useResource } from '../hooks/useResource'
import { incidentService } from '../services/incidentService'
import { INCIDENT_STATUSES, INCIDENT_TYPES, SEVERITIES, type Incident, type IncidentStatus, type IncidentType, type Severity } from '../types/api'
import { INCIDENT_TYPE_LABEL, SEVERITY_LABEL, STATUS_LABEL } from '../utils/format'

/**
 * Incident tracking. A reporter sees their own incidents; a dispatcher sees all of them and gets Dispatch / Resolve
 * buttons (the backend decides who may do what). Filters work on the loaded list.
 */
export default function Incidents() {
  const { isAdmin } = useAuth()
  const incidents = useResource<Incident[]>((signal) => incidentService.list(undefined, signal))
  const { dialog, buttonsFor } = useIncidentActions(() => void incidents.reload())

  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<IncidentStatus | ''>('')
  const [type, setType] = useState<IncidentType | ''>('')
  const [severity, setSeverity] = useState<Severity | ''>('')

  // "/app/incidents?open=12" opens the details of incident 12 (used by links from other pages)
  useEffect(() => {
    const open = Number(params.get('open'))
    if (open > 0) setSelectedId(open)
  }, [params])

  const list = incidents.data ?? []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list.filter(
      (i) =>
        (!status || i.status === status) &&
        (!type || i.type === type) &&
        (!severity || i.severity === severity) &&
        (!q || String(i.id) === q.replace('#', '') || i.description.toLowerCase().includes(q) || i.locationText.toLowerCase().includes(q) || i.reportedBy.username.toLowerCase().includes(q)),
    )
  }, [list, query, status, type, severity])

  // always show the freshest copy of the selected incident (the list is polled)
  const selected = selectedId !== null ? list.find((i) => i.id === selectedId) ?? null : null
  const closeDetail = () => {
    setSelectedId(null)
    if (params.has('open')) setParams({}, { replace: true })
  }
  const filtersActive = !!(query || status || type || severity)

  return (
    <>
      <PageHeader
        title="Incidents"
        subtitle={isAdmin ? 'Every incident in the system. Dispatch pending ones and resolve assigned ones.' : 'Your reported incidents and their current status.'}
        actions={
          <>
            <LiveStatus resource={incidents} />
            {!isAdmin && (
              <Link to="/app/report" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-600">
                <Plus className="h-4 w-4" aria-hidden="true" /> Report
              </Link>
            )}
          </>
        }
      />

      <Card padded={false}>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <TextInput id="search" label="Search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ID, description, location" className="pl-9" />
            <Search className="pointer-events-none absolute left-3 top-[37px] h-4 w-4 text-faint" aria-hidden="true" />
          </div>
          <SelectInput id="status" label="Status" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus | '')}>
            <option value="">All statuses</option>
            {INCIDENT_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}
          </SelectInput>
          <SelectInput id="type" label="Type" value={type} onChange={(e) => setType(e.target.value as IncidentType | '')}>
            <option value="">All types</option>
            {INCIDENT_TYPES.map((t) => (<option key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</option>))}
          </SelectInput>
          <SelectInput id="severity" label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | '')}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (<option key={s} value={s}>{SEVERITY_LABEL[s]}</option>))}
          </SelectInput>
        </div>

        {incidents.loading ? (
          <LoadingState label="Loading incidents..." />
        ) : incidents.error && !incidents.data ? (
          <ErrorState error={incidents.error} onRetry={() => void incidents.reload()} title="Could not load incidents" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={filtersActive ? 'No incidents match these filters' : isAdmin ? 'No incidents yet' : 'You have not reported any incident yet'}
            message={filtersActive ? 'Clear a filter or change the search.' : isAdmin ? 'Incidents appear here as soon as someone reports one.' : 'When you report an emergency it will appear here with its status.'}
          />
        ) : (
          <>
            <IncidentTable incidents={filtered} onSelect={(i) => setSelectedId(i.id)} showReporter={isAdmin} renderActions={isAdmin ? buttonsFor : undefined} />
            <p className="border-t border-line px-4 py-3 text-xs text-faint">
              Showing {filtered.length} of {list.length} incident{list.length === 1 ? '' : 's'}.
            </p>
          </>
        )}
      </Card>

      {selected && <IncidentDetail incident={selected} onClose={closeDetail} footer={isAdmin ? buttonsFor(selected) : undefined} />}
      {dialog}
    </>
  )
}

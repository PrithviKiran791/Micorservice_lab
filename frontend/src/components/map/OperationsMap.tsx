import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crosshair, MapPinOff } from 'lucide-react'
import type { Resource } from '../../hooks/useResource'
import type { Incident } from '../../types/api'
import { INCIDENT_TYPE_LABEL, SEVERITY_LABEL, STATUS_LABEL, timeAgo } from '../../utils/format'
import { incidentCoordinates, splitByCoordinates } from '../../utils/geo'
import { applyMapFilters, DEFAULT_MAP_FILTERS, type MapFilterState } from '../../utils/mapFilters'
import { markerColor } from '../../utils/mapStyle'
import { Card } from '../common/Card'
import { LiveStatus } from '../common/PageHeader'
import { EmergencyMap, type MapFocus } from './EmergencyMap'
import { MapFilters } from './MapFilters'
import { MapLegend } from './MapLegend'

/** One line in a side list. Located incidents focus the map; the rest link to the incident details. */
function Row({ incident, selected, onLocate }: { incident: Incident; selected: boolean; onLocate: (i: Incident) => void }) {
  const located = incidentCoordinates(incident) !== null
  const body = (
    <>
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: markerColor(incident.severity, incident.status) }} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">#{incident.id} {INCIDENT_TYPE_LABEL[incident.type]}, {SEVERITY_LABEL[incident.severity]}</span>
        <span className="block truncate text-xs text-mute">{incident.locationText}</span>
        <span className="block text-xs text-faint">{STATUS_LABEL[incident.status]} · {timeAgo(incident.createdAt)}</span>
      </span>
    </>
  )
  const cls = `flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors ${selected ? 'border-brand bg-brand/10' : 'border-line hover:border-faint'}`
  return (
    <li>
      {located ? (
        <button type="button" className={cls} onClick={() => onLocate(incident)} aria-label={`Show incident ${incident.id} on the map`}>{body}</button>
      ) : (
        <Link to={`/app/incidents?open=${incident.id}`} className={cls}>{body}</Link>
      )}
    </li>
  )
}

interface Props {
  incidents: Resource<Incident[]>
}

/**
 * The centre of the administrator dashboard: a large incident map with filters, a critical queue, recent incidents and
 * the incidents that have no map position. The data is refreshed by the same polling as the rest of the page (no
 * WebSocket exists), so this is an automatically refreshed incident map, not live tracking.
 */
export function OperationsMap({ incidents }: Props) {
  const [filters, setFilters] = useState<MapFilterState>(DEFAULT_MAP_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [focus, setFocus] = useState<MapFocus | null>(null)

  const all = useMemo(() => incidents.data ?? [], [incidents.data])
  const filtered = useMemo(() => applyMapFilters(all, filters), [all, filters])
  const { located, unlocated } = useMemo(() => splitByCoordinates(filtered), [filtered])

  // the critical queue ignores the filters on purpose: an open critical incident must never be filtered out of sight
  const critical = useMemo(
    () => all.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [all],
  )
  const recent = useMemo(() => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6), [filtered])

  function locate(incident: Incident) {
    const position = incidentCoordinates(incident)
    setSelectedId(incident.id)
    if (position) setFocus({ position, nonce: Date.now() })
  }

  return (
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card
        title="Incident map"
        subtitle="Incidents at their reported positions, refreshed automatically (not live GPS tracking)"
        actions={<LiveStatus resource={incidents} />}
      >
        <EmergencyMap
          incidents={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          focus={focus}
          loading={incidents.loading}
          error={incidents.data ? incidents.error : null}
          onRetry={() => void incidents.reload()}
          className="h-[440px] sm:h-[560px] xl:h-[640px]"
        />
        <div className="mt-3"><MapLegend /></div>
        <p className="mt-3 text-xs text-faint" aria-live="polite">
          {located.length} of {filtered.length} shown incident{filtered.length === 1 ? ' has' : 's have'} a map position
          {unlocated.length > 0 ? `; ${unlocated.length} without a position ${unlocated.length === 1 ? 'is' : 'are'} listed on the right.` : '.'}
        </p>
      </Card>

      <div className="space-y-6">
        <Card title="Filters">
          <MapFilters value={filters} onChange={setFilters} shown={filtered.length} total={all.length} />
        </Card>

        <Card title="Critical incident queue" subtitle="Open critical incidents, oldest first (not filtered)">
          {critical.length === 0 ? (
            <p className="text-sm text-mute">{incidents.data ? 'No open critical incident.' : 'Waiting for incident data.'}</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {critical.map((i) => (<Row key={i.id} incident={i} selected={i.id === selectedId} onLocate={locate} />))}
            </ul>
          )}
        </Card>

        <Card title="Recent incidents" subtitle="Latest reports that match the filters">
          {recent.length === 0 ? (
            <p className="text-sm text-mute">{filtered.length === 0 && all.length > 0 ? 'No incident matches the filters.' : 'No incidents yet.'}</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((i) => (<Row key={i.id} incident={i} selected={i.id === selectedId} onLocate={locate} />))}
            </ul>
          )}
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><MapPinOff className="h-4 w-4 text-mute" aria-hidden="true" /> Without a map position ({unlocated.length})</span>}
          subtitle="Reported without coordinates, so they cannot be drawn. Open one for its details."
        >
          {unlocated.length === 0 ? (
            <p className="text-sm text-mute">Every shown incident has a position.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {unlocated.map((i) => (<Row key={i.id} incident={i} selected={false} onLocate={locate} />))}
            </ul>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-xs text-faint"><Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Reporters can pin the position on the map when they report an emergency.</p>
        </Card>
      </div>
    </div>
  )
}

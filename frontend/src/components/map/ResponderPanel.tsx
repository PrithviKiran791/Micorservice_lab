import { Link } from 'react-router-dom'
import type { Incident, Responder } from '../../types/api'
import { RESPONDER_TYPE_LABEL } from '../../utils/format'
import { ResponderStatusBadge } from '../common/Badge'
import { Card } from '../common/Card'
import { AvailabilitySummary } from '../responders/AvailabilitySummary'

interface Props {
  responders: Responder[] | null
  unavailable: boolean
  incidentById: Map<number, Incident>
}

/**
 * Responders are NOT drawn on the map: the responder service stores a zone and an assignment for each responder but no
 * coordinates, so any position would be invented. This panel shows what is real: availability and current assignment.
 */
export function ResponderPanel({ responders, unavailable, incidentById }: Props) {
  const list = responders ?? []
  const busy = list.filter((r) => r.status === 'BUSY')
  const free = list.filter((r) => r.status === 'AVAILABLE')
  return (
    <Card title="Responders" subtitle="Availability and assignments (no positions: see the note)" actions={<Link to="/app/responders" className="text-sm font-medium text-brand hover:underline">Details</Link>}>
      {responders === null ? (
        <p className="text-sm text-mute">{unavailable ? 'Responder data is unavailable right now (the responder service is not answering).' : 'Loading responders...'}</p>
      ) : (
        <>
          <AvailabilitySummary responders={list} />
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-faint">Busy ({busy.length})</h3>
          {busy.length === 0 ? (
            <p className="mt-1 text-sm text-mute">No responder is busy.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {busy.map((r) => {
                const inc = r.currentIncidentId !== null ? incidentById.get(r.currentIncidentId) : undefined
                return (
                  <li key={r.id} className="rounded-lg border border-line bg-night px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{r.name}</span>
                      <ResponderStatusBadge status={r.status} />
                    </div>
                    <p className="text-xs text-mute">
                      {RESPONDER_TYPE_LABEL[r.type]}{r.zone ? ` · ${r.zone} zone` : ''} · <Link to={`/app/incidents?open=${r.currentIncidentId}`} className="font-medium text-brand hover:underline">Incident #{r.currentIncidentId}</Link>
                      {inc ? ` · ${inc.locationText}` : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-faint">Available ({free.length})</h3>
          {free.length === 0 ? (
            <p className="mt-1 text-sm text-mute">No responder is free right now.</p>
          ) : (
            <p className="mt-1 text-sm text-ink">{free.map((r) => `${r.name}${r.zone ? ` (${r.zone})` : ''}`).join(', ')}</p>
          )}
        </>
      )}
      <p className="mt-5 rounded-md border border-line bg-panel-2 p-3 text-xs text-mute">
        Responders have no map position because the responder service stores none, and nothing reports their location. This is not live tracking. Showing responders on the map would need a location-reporting capability (see docs/MAP.md, future work).
      </p>
    </Card>
  )
}

import { Link } from 'react-router-dom'
import type { Incident, Responder } from '../../types/api'
import { RESPONDER_TYPE_ICON, ResponderStatusBadge } from '../common/Badge'
import { RESPONDER_TYPE_LABEL } from '../../utils/format'

/**
 * One responder. "Current assignment" is the id of the incident it is handling, which is all the backend exposes;
 * when the caller also knows the incident (a dispatcher sees every incident) its description is shown too.
 */
export function ResponderCard({ responder, incident }: { responder: Responder; incident?: Incident }) {
  const Icon = RESPONDER_TYPE_ICON[responder.type]
  const busy = responder.status === 'BUSY'
  return (
    <li className={`rounded-xl border bg-panel p-4 ${busy ? 'border-amber/40' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`rounded-lg p-2.5 ${responder.status === 'AVAILABLE' ? 'bg-ok/15 text-ok' : busy ? 'bg-amber/15 text-amber' : 'bg-panel-2 text-mute'}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{responder.name}</p>
            <p className="text-xs text-mute">{RESPONDER_TYPE_LABEL[responder.type]}{responder.zone ? ` · ${responder.zone} zone` : ''}</p>
          </div>
        </div>
        <ResponderStatusBadge status={responder.status} />
      </div>

      <div className="mt-4 border-t border-line pt-3 text-sm">
        {responder.currentIncidentId !== null ? (
          <p className="text-mute">
            Handling{' '}
            <Link to={`/app/incidents?open=${responder.currentIncidentId}`} className="font-medium text-brand hover:underline">
              incident #{responder.currentIncidentId}
            </Link>
            {incident && <span className="mt-0.5 block truncate text-xs text-faint" title={incident.description}>{incident.description}</span>}
          </p>
        ) : (
          <p className="text-faint">{responder.status === 'OFFLINE' ? 'Not in service' : 'No current assignment'}</p>
        )}
      </div>
    </li>
  )
}

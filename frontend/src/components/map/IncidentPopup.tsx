import { Link } from 'react-router-dom'
import type { Incident } from '../../types/api'
import { formatDateTime, RESPONDER_TYPE_LABEL, timeAgo } from '../../utils/format'
import { formatCoordinates, incidentCoordinates } from '../../utils/geo'
import { IncidentTypeLabel, SeverityBadge, StatusBadge } from '../common/Badge'

/**
 * The content of a marker popup. Everything shown is a field of the incident returned by the API; nothing is invented.
 * "View details" opens the incident detail dialog, which loads the incident with GET /api/incidents/{id}.
 */
export function IncidentPopup({ incident }: { incident: Incident }) {
  const position = incidentCoordinates(incident)
  return (
    <div className="w-[230px] max-w-full space-y-2">
      <p className="text-sm font-semibold text-ink">Incident #{incident.id}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <IncidentTypeLabel type={incident.type} />
        <SeverityBadge severity={incident.severity} />
        <StatusBadge status={incident.status} />
      </div>
      <dl className="space-y-1 text-xs">
        <div>
          <dt className="text-faint">Location</dt>
          <dd className="break-words text-ink">{incident.locationText}</dd>
        </div>
        <div>
          <dt className="text-faint">Responder</dt>
          <dd className="text-ink">
            {incident.assignedResponder ? (
              <>
                {incident.assignedResponder.name} <span className="text-mute">({RESPONDER_TYPE_LABEL[incident.assignedResponder.type]})</span>
              </>
            ) : (
              <span className="text-mute">{incident.status === 'RESOLVED' ? 'none recorded' : 'not assigned yet'}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-faint">Reported</dt>
          <dd className="text-ink">
            {formatDateTime(incident.createdAt)} <span className="text-mute">({timeAgo(incident.createdAt)})</span>
          </dd>
        </div>
        {position && <div className="text-faint">{formatCoordinates(position)}</div>}
      </dl>
      <Link
        to={`/app/incidents?open=${incident.id}`}
        className="inline-flex h-8 items-center rounded-md bg-brand px-3 text-xs font-semibold !text-white no-underline hover:bg-brand-600"
      >
        View details
      </Link>
    </div>
  )
}

import type { ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import type { Incident } from '../../types/api'
import { formatDateTime, timeAgo } from '../../utils/format'
import { IncidentTypeLabel, SeverityBadge, StatusBadge } from '../common/Badge'

interface IncidentTableProps {
  incidents: Incident[]
  onSelect: (incident: Incident) => void
  /** Show who reported each incident (useful for dispatchers, who see everyone's incidents). */
  showReporter?: boolean
  /** Optional extra column on the right, e.g. dispatch / resolve buttons. */
  renderActions?: (incident: Incident) => ReactNode
}

const responderText = (i: Incident): string => (i.assignedResponder ? i.assignedResponder.name : i.status === 'PENDING' || i.status === 'REPORTED' ? 'Waiting for a responder' : '-')

/** Left edge colour: red for critical incidents that are still open. */
const edge = (i: Incident): string => (i.severity === 'CRITICAL' && i.status !== 'RESOLVED' ? 'border-l-critical' : 'border-l-transparent')

/**
 * A responsive list of incidents: a real table on wide screens (the sidebar needs room) and stacked cards on phones and tablets.
 * Rows are keyboard accessible (Enter opens the details).
 */
export function IncidentTable({ incidents, onSelect, showReporter = false, renderActions }: IncidentTableProps) {
  return (
    <>
      {/* wide screens */}
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-faint">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">ID</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Severity</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Description</th>
              <th scope="col" className="hidden px-4 py-3 font-medium 2xl:table-cell">Location</th>
              <th scope="col" className="px-4 py-3 font-medium">Responder</th>
              {showReporter && <th scope="col" className="px-4 py-3 font-medium">Reported by</th>}
              <th scope="col" className="px-4 py-3 font-medium">Reported</th>
              {renderActions && <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {incidents.map((i) => (
              <tr
                key={i.id}
                tabIndex={0}
                onClick={() => onSelect(i)}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(i)}
                className={`cursor-pointer border-l-4 transition-colors hover:bg-panel-2 focus-visible:bg-panel-2 ${edge(i)}`}
              >
                <td className="px-4 py-3 font-medium tabular-nums text-ink">#{i.id}</td>
                <td className="px-4 py-3"><IncidentTypeLabel type={i.type} /></td>
                <td className="px-4 py-3"><SeverityBadge severity={i.severity} /></td>
                <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                <td className="max-w-48 truncate px-4 py-3 text-ink" title={i.description}>{i.description}</td>
                <td className="hidden max-w-44 truncate px-4 py-3 text-mute 2xl:table-cell" title={i.locationText}>{i.locationText}</td>
                <td className={`px-4 py-3 ${i.assignedResponder ? 'text-ink' : 'text-amber'}`}>{responderText(i)}</td>
                {showReporter && <td className="px-4 py-3 text-mute">{i.reportedBy.username}</td>}
                <td className="whitespace-nowrap px-4 py-3 text-mute" title={formatDateTime(i.createdAt)}>{timeAgo(i.createdAt)}</td>
                {renderActions && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {renderActions(i)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* phones */}
      <ul className="divide-y divide-line xl:hidden">
        {incidents.map((i) => (
          <li key={i.id} className={`border-l-4 ${edge(i)}`}>
            <button type="button" onClick={() => onSelect(i)} className="block w-full px-4 py-4 text-left hover:bg-panel-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold tabular-nums text-ink">#{i.id}</span>
                <StatusBadge status={i.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <IncidentTypeLabel type={i.type} />
                <SeverityBadge severity={i.severity} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-ink">{i.description}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-mute">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{i.locationText}</span>
              </p>
              <p className="mt-2 text-xs text-faint">
                {responderText(i)} · {timeAgo(i.createdAt)}
                {showReporter ? ` · ${i.reportedBy.username}` : ''}
              </p>
            </button>
            {renderActions && <div className="px-4 pb-4">{renderActions(i)}</div>}
          </li>
        ))}
      </ul>
    </>
  )
}

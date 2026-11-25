import type { ReactNode } from 'react'
import type { Incident } from '../../types/api'
import { formatDateTime } from '../../utils/format'
import { IncidentTypeLabel, ResponderTypeLabel, SeverityBadge, StatusBadge } from '../common/Badge'
import { Modal } from '../common/Modal'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 text-sm">
      <dt className="text-mute">{label}</dt>
      <dd className="col-span-2 break-words text-ink">{children}</dd>
    </div>
  )
}

/** Every field the API returns for one incident, in a dialog. `footer` carries the dispatcher actions, when allowed. */
export function IncidentDetail({ incident, onClose, footer }: { incident: Incident; onClose: () => void; footer?: ReactNode }) {
  const hasCoordinates = incident.latitude !== null && incident.longitude !== null
  return (
    <Modal title={`Incident #${incident.id}`} onClose={onClose} footer={footer}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={incident.status} />
        <SeverityBadge severity={incident.severity} />
        <IncidentTypeLabel type={incident.type} />
      </div>

      <dl className="divide-y divide-line">
        <Row label="Description">{incident.description}</Row>
        <Row label="Location">
          {incident.locationText}
          {hasCoordinates && <span className="mt-0.5 block text-xs text-mute">{incident.latitude}, {incident.longitude}</span>}
        </Row>
        <Row label="Reported by">{incident.reportedBy.username}</Row>
        <Row label="Responder">
          {incident.assignedResponder ? (
            <span className="space-y-1">
              <span className="block font-medium">{incident.assignedResponder.name}</span>
              <ResponderTypeLabel type={incident.assignedResponder.type} />
            </span>
          ) : incident.status === 'PENDING' || incident.status === 'REPORTED' ? (
            <span className="text-amber">Waiting for a responder</span>
          ) : (
            '-'
          )}
        </Row>
        <Row label="Reported">{formatDateTime(incident.createdAt)}</Row>
        <Row label="Last update">{formatDateTime(incident.updatedAt)}</Row>
        {incident.resolvedAt && <Row label="Resolved">{formatDateTime(incident.resolvedAt)}</Row>}
      </dl>
    </Modal>
  )
}

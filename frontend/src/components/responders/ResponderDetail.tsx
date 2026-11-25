import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useResource } from '../../hooks/useResource'
import { incidentService } from '../../services/incidentService'
import { responderService } from '../../services/responderService'
import type { Incident, Responder } from '../../types/api'
import { RESPONDER_STATUS_LABEL, RESPONDER_TYPE_LABEL } from '../../utils/format'
import { ResponderStatusBadge, ResponderTypeLabel, StatusBadge } from '../common/Badge'
import { Modal } from '../common/Modal'
import { ErrorState, LoadingState } from '../common/States'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 text-sm">
      <dt className="text-mute">{label}</dt>
      <dd className="col-span-2 break-words text-ink">{children}</dd>
    </div>
  )
}

/**
 * One responder, from GET /api/responders/{id}. A dispatcher also sees the incident it is handling
 * (GET /api/incidents/{id}); a reporter may only read their own incidents, so for them only the id is shown.
 */
export function ResponderDetail({ id, fallback, onClose }: { id: number; fallback?: Responder; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const res = useResource<Responder>((signal) => responderService.get(id, signal))
  const responder = res.data ?? fallback ?? null
  const incidentId = responder?.currentIncidentId ?? null
  const incident = useResource<Incident>((signal) => incidentService.get(incidentId as number, signal), { enabled: isAdmin && incidentId !== null })

  if (!responder) {
    return (
      <Modal title={`Responder #${id}`} onClose={onClose}>
        {res.loading ? <LoadingState label="Loading responder..." /> : res.error ? <ErrorState error={res.error} onRetry={() => void res.reload()} title={res.error.status === 404 ? 'Responder not found' : 'Could not load the responder'} /> : null}
      </Modal>
    )
  }

  return (
    <Modal title={responder.name} onClose={onClose}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ResponderStatusBadge status={responder.status} />
        <ResponderTypeLabel type={responder.type} />
      </div>
      <dl className="divide-y divide-line">
        <Row label="Responder ID">#{responder.id}</Row>
        <Row label="Type">{RESPONDER_TYPE_LABEL[responder.type]}</Row>
        <Row label="Zone">{responder.zone ?? '-'}</Row>
        <Row label="Availability">{RESPONDER_STATUS_LABEL[responder.status]}</Row>
        <Row label="Assignment">
          {incidentId === null ? (
            <span className="text-faint">{responder.status === 'OFFLINE' ? 'Not in service' : 'No current assignment'}</span>
          ) : (
            <span className="space-y-1">
              <Link to={`/app/incidents?open=${incidentId}`} className="font-medium text-brand hover:underline">Incident #{incidentId}</Link>
              {incident.data && (
                <span className="block text-xs text-mute">
                  <StatusBadge status={incident.data.status} /> <span className="ml-1">{incident.data.description}</span>
                </span>
              )}
            </span>
          )}
        </Row>
      </dl>
    </Modal>
  )
}

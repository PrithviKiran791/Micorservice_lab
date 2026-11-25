import { useEffect, useRef, type ReactNode } from 'react'
import { useResource } from '../../hooks/useResource'
import { incidentService } from '../../services/incidentService'
import type { Incident } from '../../types/api'
import { Modal } from '../common/Modal'
import { ErrorState, LoadingState } from '../common/States'
import { IncidentDetail } from './IncidentDetail'

interface Props {
  id: number
  /** The copy from the already loaded list, shown instantly while the detail request is running. */
  fallback?: Incident | null
  onClose: () => void
  /** Dispatcher buttons; receives the freshest copy of the incident. */
  footer?: (incident: Incident) => ReactNode
  /** Change this number to make the dialog fetch the incident again (after dispatch / resolve). */
  refreshToken?: number
}

/**
 * The incident dialog. It asks the backend for this one incident (GET /api/incidents/{id}), so it shows the
 * authoritative, current copy, also when opened through a deep link (/app/incidents?open=12) for an incident that
 * is not in the list. A 403 (someone else's incident) or 404 is shown as a message, not as a blank dialog.
 */
export function IncidentDetailLoader({ id, fallback, onClose, footer, refreshToken = 0 }: Props) {
  const res = useResource<Incident>((signal) => incidentService.get(id, signal))

  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    void res.reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the token changes
  }, [refreshToken])

  const incident = res.data ?? fallback ?? null
  if (!incident) {
    return (
      <Modal title={`Incident #${id}`} onClose={onClose}>
        {res.loading ? (
          <LoadingState label="Loading incident..." />
        ) : res.error ? (
          <ErrorState
            error={res.error}
            onRetry={() => void res.reload()}
            title={res.error.status === 404 ? 'Incident not found' : res.error.status === 403 ? 'This incident is not yours' : 'Could not load the incident'}
          />
        ) : null}
      </Modal>
    )
  }
  return <IncidentDetail incident={incident} onClose={onClose} footer={footer?.(incident)} />
}

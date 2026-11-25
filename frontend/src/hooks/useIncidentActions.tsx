import { useCallback, useState, type ReactNode } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { Button } from '../components/common/Button'
import { ConfirmDialog } from '../components/common/Modal'
import { useToast } from '../contexts/ToastContext'
import { toAppError } from '../services/errors'
import { incidentService } from '../services/incidentService'
import type { Incident } from '../types/api'

type Pending = { kind: 'dispatch' | 'resolve'; incident: Incident } | null

/**
 * The two dispatcher actions of the backend, with a confirmation step and clear feedback:
 *  - dispatch: retry the responder assignment of a PENDING incident (the result can still be PENDING),
 *  - resolve: free the responder and close an ASSIGNED incident (fails with 503 while responder-service is down).
 * Only an administrator can use them: the backend answers 403 for anybody else.
 */
export function useIncidentActions(onChanged: () => void) {
  const { notify } = useToast()
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)

  const confirm = useCallback(async () => {
    if (!pending) return
    const { kind, incident } = pending
    setBusy(true)
    try {
      if (kind === 'dispatch') {
        const result = await incidentService.dispatch(incident.id)
        if (result.status === 'ASSIGNED') notify('success', `Incident #${result.id} dispatched`, `${result.assignedResponder?.name ?? 'A responder'} is on the way.`)
        else notify('warning', `Incident #${result.id} is still pending`, 'No responder is available right now, or the responder service is down. It stays in the queue.')
      } else {
        const result = await incidentService.resolve(incident.id)
        notify('success', `Incident #${result.id} resolved`, 'The responder has been released.')
      }
      setPending(null)
      onChanged()
    } catch (e) {
      const err = toAppError(e)
      const title = kind === 'dispatch' ? 'Dispatch failed' : 'Could not resolve the incident'
      notify('error', title, err.code === 'INVALID_STATE' ? 'The incident is not in the right state any more. The list has been refreshed.' : err.message)
      setPending(null)
      onChanged()
    } finally {
      setBusy(false)
    }
  }, [pending, notify, onChanged])

  const dialog: ReactNode = pending && (
    <ConfirmDialog
      title={pending.kind === 'dispatch' ? `Dispatch incident #${pending.incident.id}?` : `Resolve incident #${pending.incident.id}?`}
      message={
        pending.kind === 'dispatch'
          ? 'The system will try to assign an available responder of the matching type to this incident.'
          : `This closes the incident and makes ${pending.incident.assignedResponder?.name ?? 'the responder'} available again.`
      }
      confirmLabel={pending.kind === 'dispatch' ? 'Dispatch' : 'Resolve'}
      loading={busy}
      onConfirm={() => void confirm()}
      onCancel={() => !busy && setPending(null)}
    />
  )

  /** The buttons that are valid for an incident in its current status (none for a RESOLVED incident). */
  const buttonsFor = useCallback(
    (incident: Incident): ReactNode => {
      if (incident.status === 'PENDING')
        return (
          <Button size="sm" icon={Send} onClick={() => setPending({ kind: 'dispatch', incident })}>
            Dispatch
          </Button>
        )
      if (incident.status === 'ASSIGNED')
        return (
          <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => setPending({ kind: 'resolve', incident })}>
            Resolve
          </Button>
        )
      return null
    },
    [],
  )

  return { dialog, buttonsFor }
}

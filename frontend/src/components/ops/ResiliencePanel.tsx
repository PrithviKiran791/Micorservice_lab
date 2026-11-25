import { Link } from 'react-router-dom'
import type { OpsHealth, OpsResilience } from '../../types/ops'
import { timeAgo } from '../../utils/format'
import { podName, serviceByName } from '../../utils/ops'
import { Card } from '../common/Card'
import { SourceTag, StatusPill } from './StatusPill'

const PROBLEM_EVENTS = ['ERROR', 'NOT_PERMITTED', 'FAILURE_RATE_EXCEEDED', 'STATE_TRANSITION']

interface Step {
  title: string
  detail: string
  status: 'observed' | 'not-observed' | 'admin' | 'result' | 'unknown'
  evidence: string
}

/** The seven steps of the failure scenario, each with what the live data says about it right now. */
function scenario(health: OpsHealth, resilience: OpsResilience | null, pending: number | null, assigned: number | null): Step[] {
  const responder = serviceByName(health, 'responder-service')
  const responderDown = responder ? responder.status !== 'UP' : null
  const instances = resilience?.instances.filter((i) => i.available) ?? []
  const problems = instances.flatMap((i) => i.events ?? []).filter((e) => PROBLEM_EVENTS.includes(e.type))
  const states = instances.flatMap((i) => Object.values(i.circuitBreakers ?? {}).map((b) => b.state))
  const breakerOpen = states.some((s) => s !== 'CLOSED')

  return [
    {
      title: 'Responder Service becomes unavailable',
      detail: 'For example its pod stops or crashes.',
      status: responderDown === null ? 'unknown' : responderDown ? 'observed' : 'not-observed',
      evidence: responderDown === null ? 'Health unknown.' : responderDown ? `Responder Service is ${responder?.status} right now.` : 'Responder Service is UP right now.',
    },
    {
      title: 'Incident Service cannot complete the automatic assignment',
      detail: 'The call to the responder service is refused, times out or is blocked by the open circuit.',
      status: !resilience ? 'unknown' : problems.length > 0 || (pending ?? 0) > 0 ? 'observed' : 'not-observed',
      evidence: !resilience ? 'Circuit-breaker data unavailable.' : problems.length > 0 || (pending ?? 0) > 0 ? `${problems.length} failed, blocked or state-change breaker event(s) in the recent history; ${pending ?? 0} incident(s) waiting as PENDING.` : 'No failed or blocked call in the recent history of the pods and no PENDING incident.',
    },
    {
      title: 'Circuit breaker and fallback handle the failure',
      detail: 'After enough failures the breaker opens and calls fail fast; the fallback answers instead of an error.',
      status: !resilience ? 'unknown' : breakerOpen || (pending ?? 0) > 0 ? 'observed' : 'not-observed',
      evidence: !resilience ? 'Circuit-breaker data unavailable.' : states.length === 0 ? 'No breaker reported.' : `Breaker state now: ${[...new Set(states)].join(', ')}. The PENDING incidents are the proof that the fallback answered. Note: if Eureka has already dropped the responder service, the call fails at once (no instance to call); the fallback still answers, but the breaker stays CLOSED. It opens when the service is registered yet not answering (crash, timeout, HTTP 5xx).`,
    },
    {
      title: 'The incident is stored as PENDING',
      detail: 'The report is accepted and saved; it simply has no responder yet.',
      status: pending === null ? 'unknown' : pending > 0 ? 'observed' : 'not-observed',
      evidence: pending === null ? 'Incident list unavailable.' : `${pending} incident(s) are PENDING right now (calculated from the incident list).`,
    },
    {
      title: 'Responder Service recovers',
      detail: 'The pod is back and registered in Eureka again.',
      status: responderDown === null ? 'unknown' : !responderDown && (problems.length > 0 || (pending ?? 0) > 0) ? 'observed' : 'not-observed',
      evidence: responderDown === null ? 'Health unknown.' : responderDown ? 'Still unavailable.' : problems.length > 0 || (pending ?? 0) > 0 ? 'Responder Service is UP again after the failure recorded above.' : 'Responder Service is UP, and no failure is recorded, so there is nothing to recover from.',
    },
    {
      title: 'The administrator dispatches the pending incident',
      detail: 'A manual action on the admin dashboard retries the assignment.',
      status: 'admin',
      evidence: 'Performed by an administrator; there is no automatic retry.',
    },
    {
      title: 'The incident becomes ASSIGNED',
      detail: 'A responder is attached and the user is notified.',
      status: assigned === null ? 'unknown' : 'result',
      evidence: assigned === null ? 'Incident list unavailable.' : `${assigned} incident(s) are ASSIGNED right now (any route, not only after a dispatch). Watch this number rise when you dispatch.`,
    },
  ]
}

const CHIP: Record<Step['status'], { text: string; cls: string }> = {
  observed: { text: 'Observed now', cls: 'border-ok/40 text-ok' },
  'not-observed': { text: 'Not happening now', cls: 'border-line text-mute' },
  admin: { text: 'Admin action', cls: 'border-sky/40 text-sky' },
  result: { text: 'Result of step 6', cls: 'border-sky/40 text-sky' },
  unknown: { text: 'Unknown', cls: 'border-line text-faint' },
}

/** G. Real Resilience4j state of every incident-service pod plus the failure scenario with live evidence. */
export function ResiliencePanel({ health, resilience, pending, assigned }: { health: OpsHealth; resilience: OpsResilience | null; pending: number | null; assigned: number | null }) {
  const steps = scenario(health, resilience, pending, assigned)
  return (
    <Card
      title="Resilience (Resilience4j circuit breaker)"
      subtitle="Breaker responderService protects the call from the incident service to the responder service. Each incident-service pod has its own breaker."
      actions={<SourceTag kind="live" />}
    >
      {!resilience ? (
        <p className="text-sm text-amber">Circuit-breaker state could not be read, so none is shown.</p>
      ) : resilience.instances.length === 0 ? (
        <p className="text-sm text-amber">{resilience.registryReadable ? 'No incident-service pod is registered, so there is no breaker to read.' : 'The registry could not be read.'}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {resilience.instances.map((i) => (
            <li key={i.instanceId} className="rounded-lg border border-line p-3">
              <p className="text-xs font-medium text-ink">{podName(i.instanceId)}</p>
              {!i.available ? (
                <p className="mt-2 text-xs text-amber">Not available: {i.reason}</p>
              ) : (
                Object.entries(i.circuitBreakers ?? {}).map(([name, b]) => (
                  <div key={name} className="mt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-mute">{name}</span>
                      <StatusPill state={b.state} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-mute">
                      <dt>Failure rate</dt><dd className="text-right tabular-nums text-ink">{b.failureRate}</dd>
                      <dt>Calls in window</dt><dd className="text-right tabular-nums text-ink">{b.bufferedCalls ?? '-'}</dd>
                      <dt>Failed calls</dt><dd className="text-right tabular-nums text-ink">{b.failedCalls ?? '-'}</dd>
                      <dt>Blocked while open</dt><dd className="text-right tabular-nums text-ink">{b.notPermittedCalls ?? '-'}</dd>
                    </dl>
                    <p className="mt-1 text-[11px] text-faint">A failure rate of -1% means too few calls have been made to judge yet (minimum 3).</p>
                  </div>
                ))
              )}
              {i.available && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-ink">Recent events (newest first)</p>
                  {(i.events ?? []).length === 0 ? (
                    <p className="mt-1 text-xs text-faint">None recorded since this pod started.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-xs text-mute">
                      {(i.events ?? []).slice(0, 6).map((e, idx) => (
                        <li key={idx}>
                          <span className="font-medium text-ink">{e.type}</span>
                          {e.stateTransition ? ` ${e.stateTransition.replaceAll('_', ' ')}` : ''}
                          <span className="text-faint"> · {timeAgo(e.time.replace(/\[.*\]$/, ''))}</span>
                          {e.errorMessage && <span className="block truncate text-faint" title={e.errorMessage}>{e.errorMessage}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-sm font-semibold text-ink">The failure scenario, with live evidence</h3>
      <ol className="mt-3 space-y-2">
        {steps.map((s, idx) => (
          <li key={s.title} className="flex gap-3 rounded-lg border border-line p-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panel-2 text-xs font-semibold text-mute">{idx + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink">{s.title}</p>
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CHIP[s.status].cls}`}>{CHIP[s.status].text}</span>
              </div>
              <p className="text-xs text-mute">{s.detail}</p>
              <p className="mt-1 text-xs text-faint">{s.evidence}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-faint">
        Limits: the breaker keeps only a short event history in memory (lost when a pod restarts), and the system has no counter of how many times the fallback ran, so the evidence above is the breaker state, its events and the PENDING incidents. To try the scenario, follow the steps on the <Link to="/app/lab#demo" className="text-brand hover:underline">Lab Evaluation</Link> page.
      </p>
    </Card>
  )
}

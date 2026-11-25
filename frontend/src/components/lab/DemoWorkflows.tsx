import { Link } from 'react-router-dom'
import { Card } from '../common/Card'
import { SourceTag } from '../ops/StatusPill'

interface Step {
  text: string
  /** A page to open for this step. */
  to?: string
  /** A command to type in PowerShell (shown, never executed from the browser). */
  command?: string
}

interface Workflow {
  id: string
  title: string
  goal: string
  steps: Step[]
  note?: string
}

const WORKFLOWS: Workflow[] = [
  {
    id: 'normal',
    title: 'Workflow 1: normal emergency dispatch',
    goal: 'Shows the synchronous call, the RabbitMQ event and the notification.',
    steps: [
      { text: 'Sign out, then sign in (or register) as a reporter (USER).', to: '/login' },
      { text: 'Report a medical emergency with severity Critical.', to: '/app/report' },
      { text: 'The incident service saves it and calls the responder service (REST).' },
      { text: 'The responder service assigns an ambulance; the report shows ASSIGNED and the responder name.' },
      { text: 'The incident service publishes an event to RabbitMQ; the notification service consumes it.' },
      { text: 'Open Notifications: "Incident #n assigned to ..." appears with an unread mark (it appears within seconds, by polling).', to: '/app/notifications' },
      { text: 'Open My incidents: the status is ASSIGNED.', to: '/app/incidents' },
    ],
  },
  {
    id: 'resilience',
    title: 'Workflow 2: resilience demonstration',
    goal: 'Shows the circuit breaker, the PENDING fallback and the manual dispatch after recovery.',
    steps: [
      { text: 'As administrator, open Service health > Resilience and keep it on screen.', to: '/app/health#resilience' },
      { text: 'Make the responder service unavailable with an authorized operational command (not from the browser):', command: 'kubectl -n resqnet scale deploy/responder-service --replicas=0' },
      { text: 'Watch the Responder Service turn DOWN on the health monitor (about 15 s, until Eureka evicts it).', to: '/app/health#services' },
      { text: 'As a reporter, report an emergency. It is accepted; the status is PENDING (the fallback).', to: '/app/report' },
      { text: 'Repeat a few times: after 3 failures the breaker opens and calls fail fast.' },
      { text: 'Restore the responder service:', command: 'kubectl -n resqnet scale deploy/responder-service --replicas=1' },
      { text: 'As administrator, Dispatch the pending incident on the operations overview: it becomes ASSIGNED.', to: '/app/admin' },
    ],
    note: 'There is deliberately no button in the browser that stops a service. The command above needs access to the cluster, which is the authorization.',
  },
  {
    id: 'load',
    title: 'Workflow 3: load-balancing demonstration',
    goal: 'Shows that two incident-service pods share the traffic.',
    steps: [
      { text: 'Open Service health > Load balancing and note the request counters of both pods.', to: '/app/health#traffic' },
      { text: 'Run the existing load test from the repository (20 users, 1,500 requests; keep the port-forward running):', command: '.\\scripts\\load-test.ps1' },
      { text: 'Refresh the page: both pods have counted a similar number of new requests.' },
      { text: 'The script prints which pod answered (X-Served-By); a recorded run is on this page under criterion 2.' },
    ],
    note: 'The test is started from PowerShell, not from the browser, so it cannot be triggered by accident or by another user.',
  },
  {
    id: 'security',
    title: 'Workflow 4: security demonstration',
    goal: 'Shows 401 without a token, 403 for a reporter and success for an administrator.',
    steps: [
      { text: 'Open the Security page and press "Run basic checks": requests without a token answer 401.', to: '/app/security' },
      { text: 'Press "Run reporter checks": a temporary reporter is refused 403 on dispatch and on the operations API, even with a forged admin header.', to: '/app/security' },
      { text: 'Sign out and open a protected page: you are sent to the login page.' },
      { text: 'Sign in as administrator and dispatch a pending incident: it succeeds.', to: '/app/admin' },
    ],
  },
]

/** Repeatable, step-by-step demonstrations. Commands are shown for the presenter to run; the browser never changes infrastructure. */
export function DemoWorkflows({ pending, assigned }: { pending: number | null; assigned: number | null }) {
  return (
    <section id="demo" className="scroll-mt-20">
      <h2 className="text-lg font-semibold text-ink">Live demonstration workflows</h2>
      <p className="mt-1 text-sm text-mute">Four repeatable scripts for the evaluation. Current state: {pending ?? '-'} incident(s) PENDING, {assigned ?? '-'} ASSIGNED <SourceTag kind="calculated" />.</p>
      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        {WORKFLOWS.map((w) => (
          <Card key={w.id} title={w.title} subtitle={w.goal}>
            <ol className="space-y-3">
              {w.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-2 text-xs text-mute">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-ink">{s.text}{s.to && <> <Link to={s.to} className="text-brand hover:underline">Open</Link></>}</p>
                    {s.command && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-md font-sans border border-line bg-night px-3 py-2 text-xs text-sky">{s.command}</pre>}
                  </div>
                </li>
              ))}
            </ol>
            {w.note && <p className="mt-4 text-xs text-faint">{w.note}</p>}
          </Card>
        ))}
      </div>
    </section>
  )
}

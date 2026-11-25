import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleHelp, XCircle } from 'lucide-react'
import { Card } from '../components/common/Card'
import { LiveStatus, PageHeader } from '../components/common/PageHeader'
import { DemoWorkflows } from '../components/lab/DemoWorkflows'
import { SourceTag, StatusPill } from '../components/ops/StatusPill'
import { CRITERIA } from '../data/criteria'
import { LOAD_TEST, TESTS_ADDED_LATER, UNIT_TESTS } from '../data/evidence'
import { useResource } from '../hooks/useResource'
import { incidentService } from '../services/incidentService'
import { opsService } from '../services/opsService'
import { CHECKS, runCheck } from '../services/securityChecks'
import type { Incident } from '../types/api'
import type { OpsHealth, OpsKubernetes, OpsResilience, OpsTraffic } from '../types/ops'
import { liveChecks, statusOf, type LiveCheck } from '../utils/labEvaluation'

const SHORT: Record<string, string> = { deployment: 'Deployment', traffic: 'Traffic', database: 'Database', communication: 'Communication', resilience: 'Resilience', discovery: 'Discovery', security: 'Security', testing: 'Testing' }

function CheckRow({ check }: { check: LiveCheck }) {
  const Icon = check.ok === true ? CheckCircle2 : check.ok === false ? XCircle : CircleHelp
  const cls = check.ok === true ? 'text-ok' : check.ok === false ? 'text-critical' : 'text-faint'
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} aria-hidden="true" />
      <span>
        <span className="text-ink">{check.label}</span>
        <span className="block text-xs text-mute">{check.detail}</span>
      </span>
    </li>
  )
}

/**
 * The page for the college evaluation: the eight criteria, each with what is implemented, recorded evidence, live
 * checks against the running system and an honest status. PASS is only given with recorded evidence AND passing live
 * checks (or recorded results alone where nothing can be re-checked live, which is stated).
 */
export default function LabEvaluation() {
  const health = useResource<OpsHealth>((s) => opsService.health(s))
  const resilience = useResource<OpsResilience>((s) => opsService.resilience(s))
  const traffic = useResource<OpsTraffic>((s) => opsService.traffic(s))
  const k8s = useResource<OpsKubernetes>((s) => opsService.kubernetes(s))
  const incidents = useResource<Incident[]>((s) => incidentService.list(undefined, s))

  // The anonymous security requests are harmless (they only prove that the gateway says no), so they run once on load.
  const [anonymousRejected, setAnonymousRejected] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const results = await Promise.all(CHECKS.filter((c) => ['no-token', 'bad-token', 'ops-no-token'].includes(c.id)).map((c) => runCheck(c)))
      if (!cancelled) setAnonymousRejected(results.every((r) => r.passed))
    })()
    return () => { cancelled = true }
  }, [])

  const ctx = useMemo(
    () => ({ health: health.data, resilience: resilience.data, traffic: traffic.data, k8s: k8s.data, incidents: incidents.data, anonymousRejected }),
    [health.data, resilience.data, traffic.data, k8s.data, incidents.data, anonymousRejected],
  )
  const evaluated = CRITERIA.map((c) => {
    const checks = liveChecks(c.id, ctx)
    return { criterion: c, checks, result: statusOf(checks, c.evidence.length) }
  })
  const pass = evaluated.filter((e) => e.result.status === 'PASS').length
  const pending = incidents.data ? incidents.data.filter((i) => i.status === 'PENDING').length : null
  const assigned = incidents.data ? incidents.data.filter((i) => i.status === 'ASSIGNED').length : null

  return (
    <>
      <PageHeader
        title="Lab evaluation"
        subtitle="The eight lab criteria, each with implementation, recorded evidence and live checks against the running system."
        actions={<LiveStatus resource={health} />}
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute"><span className="text-2xl font-semibold text-ink">{pass}</span> of 8 criteria are PASS right now.</p>
          <ul className="flex flex-wrap gap-2">
            {evaluated.map((e) => (
              <li key={e.criterion.id}>
                <a href={`#${e.criterion.id}`} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1 text-xs text-mute hover:border-faint hover:text-ink">
                  {e.criterion.number}. {SHORT[e.criterion.id]} <StatusPill state={e.result.status} />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-xs text-faint">
          How statuses are decided: PASS needs recorded results AND every live check passing now. PARTIAL means evidence or live checks exist but not both, or a live check currently fails or cannot be read. NOT VERIFIED means neither. The existence of a source file or a configuration never counts. <SourceTag kind="live" /> values are read now, <SourceTag kind="historical" /> values are from files in the repository, <SourceTag kind="design" /> describes the architecture.
        </p>
      </Card>

      <div className="space-y-6">
        {evaluated.map(({ criterion: c, checks, result }) => (
          <section key={c.id} id={c.id} className="scroll-mt-20">
            <Card
              title={`${c.number}. ${c.name}`}
              subtitle={c.description}
              actions={<StatusPill state={result.status} />}
            >
              <p className="mb-4 text-xs text-faint">Status basis: {result.basis}.</p>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">Implementation <SourceTag kind="design" /></h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-mute">
                    {c.implementation.map((i) => (<li key={i}>{i}</li>))}
                  </ul>
                  <h3 className="mt-4 text-sm font-semibold text-ink">Architecture components</h3>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {c.components.map((x) => (<span key={x} className="rounded-md border border-line bg-panel-2 px-2 py-0.5 text-xs text-mute">{x}</span>))}
                  </p>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">Live checks <SourceTag kind="live" /></h3>
                  {checks.length === 0 ? (
                    <p className="mt-2 text-sm text-mute">Nothing to re-check live for this criterion: it relies on the recorded results below.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">{checks.map((k) => (<CheckRow key={k.label} check={k} />))}</ul>
                  )}
                </div>
              </div>

              <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold text-ink">Evidence <SourceTag kind="historical" /></h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-faint">
                    <tr><th className="py-2 pr-3 font-medium">What was done</th><th className="py-2 pr-3 font-medium">Recorded result</th><th className="py-2 font-medium">Source file</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {c.evidence.map((e) => (
                      <tr key={e.what + e.source} className="align-top">
                        <td className="py-2 pr-3 text-mute">{e.what}</td>
                        <td className="py-2 pr-3 text-ink">{e.result}<span className="block text-xs text-faint">{e.date}</span></td>
                        <td className="py-2 text-xs text-faint">{e.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {c.id === 'traffic' && (
                <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">Recorded load-test summary <SourceTag kind="historical" /></p>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                    {LOAD_TEST.summary.map(([k, v]) => (<div key={k} className="flex justify-between gap-2"><dt className="text-mute">{k}</dt><dd className="text-ink">{v}</dd></div>))}
                  </dl>
                  <ul className="mt-3 space-y-2">
                    {LOAD_TEST.distribution.map((d) => (
                      <li key={d.pod}>
                        <div className="flex justify-between gap-2 text-xs"><span className="text-ink">{d.pod}</span><span className="text-mute">{d.requests} requests ({d.share}%)</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel"><div className="h-full rounded-full bg-brand" style={{ width: `${d.share}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-faint">{LOAD_TEST.note} Live counters: Service health &gt; Load balancing.</p>
                </div>
              )}

              {c.id === 'communication' && (
                <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3 text-xs text-mute">
                  <p className="mb-2 text-sm font-medium text-ink">Flow</p>
                  <ol className="flex flex-wrap items-center gap-2">
                    {['Browser', 'API Gateway', 'Incident Service'].map((s) => (<li key={s} className="flex items-center gap-2"><span className="rounded border border-line px-2 py-1 text-ink">{s}</span><span className="text-brand">-&gt;</span></li>))}
                    <li className="flex items-center gap-2"><span className="rounded border border-brand/50 px-2 py-1 text-ink">Responder Service</span><span className="text-faint">(synchronous REST, circuit breaker)</span></li>
                  </ol>
                  <ol className="mt-2 flex flex-wrap items-center gap-2">
                    {['Incident Service', 'RabbitMQ', 'Notification Service', 'Notification centre'].map((s, i, all) => (<li key={s} className="flex items-center gap-2"><span className="rounded border border-amber/50 px-2 py-1 text-ink">{s}</span>{i < all.length - 1 && <span className="text-amber">- - &gt;</span>}</li>))}
                    <li className="text-faint">(asynchronous event)</li>
                  </ol>
                </div>
              )}

              {c.id === 'testing' && (
                <div className="mt-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">Unit tests per service <SourceTag kind="historical" /></h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-faint"><tr><th className="py-2 pr-3 font-medium">Suite</th><th className="py-2 pr-3 font-medium">Tests</th><th className="py-2 pr-3 font-medium">Result</th><th className="py-2 font-medium">Covers</th></tr></thead>
                      <tbody className="divide-y divide-line">
                        {UNIT_TESTS.map((t) => (
                          <tr key={t.suite} className="align-top">
                            <td className="py-2 pr-3 text-ink">{t.suite}<span className="block text-xs text-faint">{t.source}</span></td>
                            <td className="py-2 pr-3 tabular-nums text-ink">{t.tests ?? '-'}</td>
                            <td className="py-2 pr-3"><StatusPill state={t.result === 'PASS' ? 'PASS' : 'UNKNOWN'}>{t.result}</StatusPill></td>
                            <td className="py-2 text-xs text-mute">{t.covers}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-faint">{TESTS_ADDED_LATER.map((t) => (<li key={t}>{t}</li>))}</ul>
                </div>
              )}

              <h3 className="mt-5 text-sm font-semibold text-ink">How to demonstrate it</h3>
              <ol className="mt-2 space-y-1.5 text-sm text-mute">
                {c.demo.map((d, i) => (<li key={i} className="break-words"><span className="mr-2 text-faint">{i + 1}.</span>{d}</li>))}
              </ol>
            </Card>
          </section>
        ))}
      </div>

      <div className="mt-10">
        <DemoWorkflows pending={pending} assigned={assigned} />
      </div>
    </>
  )
}

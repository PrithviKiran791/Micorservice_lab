import { useState } from 'react'
import { KeyRound, Play, ShieldCheck } from 'lucide-react'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { PageHeader } from '../components/common/PageHeader'
import { InlineNotice } from '../components/common/States'
import { SourceTag, StatusPill } from '../components/ops/StatusPill'
import { useAuth } from '../contexts/AuthContext'
import { CHECKS, createTemporaryReporterToken, runCheck, type CheckResult } from '../services/securityChecks'
import { formatDateTime, formatRemaining } from '../utils/format'

const ROLE_MATRIX: [string, string, string, string][] = [
  ['POST /api/auth/register, /login', 'public', 'yes', 'yes'],
  ['GET /api/auth/me', 'token', 'yes', 'yes'],
  ['POST /api/incidents', 'token', 'yes', 'yes'],
  ['GET /api/incidents, /api/incidents/{id}', 'token', 'own incidents only', 'all incidents'],
  ['POST /api/incidents/{id}/dispatch, /resolve', 'token', 'no (403)', 'yes'],
  ['GET /api/responders, /api/responders/{id}', 'token', 'yes', 'yes'],
  ['GET /api/notifications, PATCH .../read', 'token', 'own only', 'own only'],
  ['GET /api/ops/* (this command center)', 'token', 'no (403)', 'yes'],
  ['/internal/** (assign, release)', 'never routed', '404', '404'],
]

/** H. Security: who you are, how the control works, and a live demonstration against the real gateway. */
export default function Security() {
  const { user, expiresAt } = useAuth()
  const [results, setResults] = useState<Record<string, CheckResult>>({})
  const [running, setRunning] = useState<'basic' | 'reporter' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function runGroup(groups: ('anonymous' | 'admin')[]) {
    setRunning('basic')
    setNotice(null)
    for (const check of CHECKS.filter((c) => groups.includes(c.group as 'anonymous' | 'admin'))) {
      const result = await runCheck(check)
      setResults((r) => ({ ...r, [check.id]: result }))
    }
    setRunning(null)
  }

  async function runReporter() {
    setRunning('reporter')
    setNotice(null)
    try {
      const token = await createTemporaryReporterToken()
      for (const check of CHECKS.filter((c) => c.group === 'reporter')) {
        const result = await runCheck(check, token)
        setResults((r) => ({ ...r, [check.id]: result }))
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'The reporter test could not run.')
    }
    setRunning(null)
  }

  return (
    <>
      <PageHeader title="Security" subtitle="How access is controlled, and a live demonstration against the real gateway." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Your session" actions={<SourceTag kind="live" note="From GET /api/auth/me and your token's expiry claim" />}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-mute">Signed in as</dt><dd className="font-medium text-ink">{user?.username}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-mute">Role</dt><dd><StatusPill state={user?.role === 'ADMIN' ? 'UP' : 'UNKNOWN'}>{user?.role}</StatusPill></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-mute">Token expires</dt><dd className="text-ink">{expiresAt ? formatDateTime(new Date(expiresAt).toISOString()) : '-'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-mute">Time left</dt><dd className="text-ink">{expiresAt ? formatRemaining(expiresAt) : '-'}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-faint">The token itself is never shown here. It is kept only in this browser tab and sent as an Authorization header.</p>
        </Card>

        <Card title="How the control works" actions={<SourceTag kind="design" />}>
          <ol className="space-y-2 text-sm text-mute">
            <li><span className="font-medium text-ink">1. Login.</span> The auth service compares the password with its BCrypt hash. Only the hash is stored; it is never returned by any endpoint.</li>
            <li><span className="font-medium text-ink">2. Token.</span> It issues a JWT signed with HS256 that carries the user id, name and role, valid for 120 minutes.</li>
            <li><span className="font-medium text-ink">3. Every request.</span> The gateway checks signature, issuer and expiry. Without a valid token the answer is 401 and no service is contacted.</li>
            <li><span className="font-medium text-ink">4. Identity headers.</span> The gateway deletes any X-User-* header sent by the client and sets them from the verified token, so a role cannot be forged.</li>
            <li><span className="font-medium text-ink">5. Roles.</span> USER or ADMIN is checked again inside the service that performs the operation (403 if not allowed).</li>
          </ol>
        </Card>
      </div>

      <Card className="mt-6" title="Role matrix" subtitle="What each role may do. The interface hides what a role cannot use, but the backend decides." actions={<SourceTag kind="design" note="From docs/API_CONTRACT.md and docs/AUTHENTICATION.md" />} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-faint">
              <tr><th className="px-5 py-3 font-medium">Endpoint</th><th className="px-3 py-3 font-medium">Access</th><th className="px-3 py-3 font-medium">USER</th><th className="px-3 py-3 font-medium">ADMIN</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ROLE_MATRIX.map(([endpoint, access, usr, adm]) => (
                <tr key={endpoint}>
                  <td className="px-5 py-2.5 text-ink">{endpoint}</td>
                  <td className="px-3 py-2.5 text-mute">{access}</td>
                  <td className="px-3 py-2.5 text-mute">{usr}</td>
                  <td className="px-3 py-2.5 text-mute">{adm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        className="mt-6"
        title="Live security demonstration"
        subtitle="Each row sends one real request through the gateway and shows the status the backend actually answered."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={Play} loading={running === 'basic'} disabled={running !== null} onClick={() => void runGroup(['anonymous', 'admin'])}>Run basic checks</Button>
            <Button size="sm" variant="secondary" icon={KeyRound} loading={running === 'reporter'} disabled={running !== null} onClick={() => void runReporter()}>Run reporter checks</Button>
          </div>
        }
        padded={false}
      >
        {notice && <div className="p-4"><InlineNotice title="Could not run">{notice}</InlineNotice></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-faint">
              <tr><th className="px-5 py-3 font-medium">Check</th><th className="px-3 py-3 font-medium">Expected</th><th className="px-3 py-3 font-medium">Actual</th><th className="px-3 py-3 font-medium">Result</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {CHECKS.map((c) => {
                const r = results[c.id]
                return (
                  <tr key={c.id} className="align-top">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{c.title}</p>
                      <p className="text-xs text-mute">{c.request}</p>
                      <p className="mt-0.5 text-xs text-faint">{c.meaning}</p>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-mute">{c.expected}</td>
                    <td className="px-3 py-3 tabular-nums text-ink">{r ? (r.actual ?? 'error') : '-'}{r?.code ? <span className="block text-xs text-faint">{r.code}</span> : null}</td>
                    <td className="px-3 py-3">{r ? <StatusPill state={r.passed ? 'PASS' : 'DOWN'}>{r.passed ? 'PASS' : 'FAIL'}</StatusPill> : <span className="text-xs text-faint">not run</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-faint">
          The reporter checks create one temporary reporter account (random name and password, role USER, never shown) to obtain a USER token; that account stays in the database like any other registration.
        </p>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Password hashing" actions={<SourceTag kind="design" />}>
          <p className="flex items-start gap-2 text-sm text-mute"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
            Passwords are hashed with BCrypt (spring-security-crypto) before they are stored. The unit test for the auth service checks that registration stores only the hash and that a wrong password and an unknown user receive the same 401 answer (recorded in the test report).</p>
        </Card>
        <Card title="Not measured" actions={<SourceTag kind="unavailable" />}>
          <p className="text-sm text-mute">
            The system keeps no counter of rejected requests (the gateway writes each rejection to its log, but there is no metric), so no "attacks blocked" figure is shown. Secrets, password hashes and tokens are never displayed anywhere in this application.
          </p>
        </Card>
      </div>
    </>
  )
}

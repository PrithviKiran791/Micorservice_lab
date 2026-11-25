import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { SelectInput } from '../components/common/FormField'
import { PageHeader } from '../components/common/PageHeader'
import { ErrorState, LoadingState } from '../components/common/States'
import { useAuth } from '../contexts/AuthContext'
import { POLL_OPTIONS, useSettings } from '../contexts/SettingsContext'
import { useResource } from '../hooks/useResource'
import { useServedBy } from '../hooks/useServedBy'
import { authService } from '../services/authService'
import { formatDateTime, formatRemaining } from '../utils/format'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
      <dt className="text-mute">{label}</dt>
      <dd className="break-all text-right font-medium text-ink">{children}</dd>
    </div>
  )
}

/** Account, session and display preferences. Everything shown here is real: the account comes from GET /api/auth/me. */
export default function Settings() {
  const { user, expiresAt, logout } = useAuth()
  const { pollMs, setPollMs } = useSettings()
  const pod = useServedBy()
  const me = useResource((signal) => authService.me(signal), { poll: false })
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account, session and how the app refreshes." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account" subtitle="As confirmed by the server (GET /api/auth/me)">
          {me.loading ? (
            <LoadingState label="Loading account..." />
          ) : me.error ? (
            <ErrorState error={me.error} onRetry={() => void me.reload()} title="Could not load the account" />
          ) : (
            <dl className="divide-y divide-line">
              <Row label="Username">{me.data?.username ?? user?.username}</Row>
              <Row label="User ID">{me.data?.id ?? user?.id}</Row>
              <Row label="Role">{(me.data?.role ?? user?.role) === 'ADMIN' ? 'Administrator (dispatcher)' : 'Reporter'}</Row>
            </dl>
          )}
        </Card>

        <Card title="Session">
          <dl className="divide-y divide-line">
            <Row label="Token expires">{expiresAt ? formatDateTime(new Date(expiresAt).toISOString()) : '-'}</Row>
            <Row label="Time left">{expiresAt ? formatRemaining(expiresAt, now) : '-'}</Row>
            <Row label="Stored">In this browser tab only (cleared when the tab closes)</Row>
          </dl>
          <p className="mt-3 text-xs text-faint">When the token expires you are signed out automatically and asked to sign in again.</p>
          <Button className="mt-4" variant="secondary" icon={LogOut} onClick={logout}>
            Sign out
          </Button>
        </Card>

        <Card title="Refresh" subtitle="The backend has no push channel (no WebSocket), so pages poll for updates.">
          <SelectInput id="poll" label="Refresh data" value={pollMs} onChange={(e) => setPollMs(Number(e.target.value))}>
            {POLL_OPTIONS.map((o) => (
              <option key={o.ms} value={o.ms}>{o.label}</option>
            ))}
          </SelectInput>
          <p className="mt-3 text-xs text-faint">Polling pauses while the browser tab is hidden. The choice is remembered on this device.</p>
        </Card>

        <Card title="Connection">
          <dl className="divide-y divide-line">
            <Row label="API base URL">{import.meta.env.VITE_API_BASE_URL ?? '/api'}</Row>
            <Row label="Last answer from pod">{pod || '-'}</Row>
          </dl>
          <p className="mt-3 text-xs text-faint">All requests go through the API gateway. The pod name shows which copy of a service answered; with two copies running you will see it change (load balancing).</p>
        </Card>
      </div>
    </>
  )
}

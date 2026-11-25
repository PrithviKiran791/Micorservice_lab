import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCircle2, ClipboardList, Clock3, Plus, UserCheck } from 'lucide-react'
import { Card } from '../components/common/Card'
import { LiveStatus, PageHeader } from '../components/common/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { EmptyState, ErrorState, InlineNotice, LoadingState } from '../components/common/States'
import { IncidentDetail } from '../components/incidents/IncidentDetail'
import { IncidentTable } from '../components/incidents/IncidentTable'
import { NotificationList } from '../components/notifications/NotificationList'
import { HoverBorderGradient } from '../components/ui/hover-border-gradient'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationsContext'
import { useResource } from '../hooks/useResource'
import { incidentService } from '../services/incidentService'
import type { Incident } from '../types/api'
import { summarize } from '../utils/stats'

/** The reporter's home page: their incident counts, recent history and the latest notifications. */
export default function Overview() {
  const { user } = useAuth()
  const incidents = useResource<Incident[]>((signal) => incidentService.list(undefined, signal))
  const { notifications, markRead } = useNotifications()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const list = incidents.data ?? []
  const summary = summarize(list)
  const loaded = incidents.data !== null
  const value = (n: number): string | number => (loaded ? n : '-')
  const recent = list.slice(0, 5)
  const selected = selectedId !== null ? list.find((i) => i.id === selectedId) ?? null : null
  const unread = notifications.filter((n) => !n.read)

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.username ?? ''}`}
        subtitle="Your incidents and their latest status."
        actions={
          <>
            <LiveStatus resource={incidents} />
            <HoverBorderGradient
              as={Link}
              to="/app/report"
              highlightColor="#ef4444"
              containerClassName="rounded-full"
              className="h-10 px-4 text-sm font-semibold"
            >
              <Plus className="h-4 w-4 text-critical" aria-hidden="true" />
              <span>Report emergency</span>
            </HoverBorderGradient>
          </>
        }
      />

      {incidents.error && !incidents.data && (
        <Card className="mb-6"><ErrorState error={incidents.error} onRetry={() => void incidents.reload()} title="Could not load your incidents" /></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total reported" value={value(summary.total)} icon={ClipboardList} />
        <StatCard label="Pending" value={value(summary.pending + summary.reported)} icon={Clock3} tone="amber" hint="Waiting for a responder" />
        <StatCard label="Assigned" value={value(summary.assigned)} icon={UserCheck} tone="ok" hint="A responder is on it" />
        <StatCard label="Resolved" value={value(summary.resolved)} icon={CheckCircle2} />
      </div>

      {summary.pending > 0 && (
        <div className="mt-6">
          <InlineNotice title={`${summary.pending} incident${summary.pending === 1 ? ' is' : 's are'} waiting for a responder`}>
            Your reports are saved. A dispatcher will assign help as soon as a responder is available.
          </InlineNotice>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card
          title="Recent incidents"
          actions={<Link to="/app/incidents" className="text-sm font-medium text-brand hover:underline">View all</Link>}
          padded={false}
        >
          {incidents.loading ? (
            <LoadingState label="Loading incidents..." />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="You have not reported any incident yet"
              message="When you report an emergency it appears here with its status."
              action={
                <HoverBorderGradient
                  as={Link}
                  to="/app/report"
                  highlightColor="#ef4444"
                  containerClassName="rounded-full"
                  className="h-9 px-4 text-sm font-medium"
                >
                  <span>Report an emergency</span>
                </HoverBorderGradient>
              }
            />
          ) : (
            <IncidentTable incidents={recent} onSelect={(i) => setSelectedId(i.id)} />
          )}
        </Card>

        <Card
          title="Notifications"
          subtitle={unread.length > 0 ? `${unread.length} unread` : 'You are up to date'}
          actions={<Link to="/app/notifications" className="text-sm font-medium text-brand hover:underline">View all</Link>}
          padded={false}
        >
          {notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet" message="You are notified when a responder is assigned or your incident is waiting." />
          ) : (
            <NotificationList notifications={notifications.slice(0, 4)} onMarkRead={(id) => void markRead(id)} compact />
          )}
        </Card>
      </div>

      {selected && <IncidentDetail incident={selected} onClose={() => setSelectedId(null)} />}
    </>
  )
}

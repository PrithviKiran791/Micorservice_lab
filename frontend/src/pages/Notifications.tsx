import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { LiveStatus, PageHeader } from '../components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { NotificationList } from '../components/notifications/NotificationList'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationsContext'

type Filter = 'all' | 'unread'

/** Notification centre. Notifications arrive asynchronously through RabbitMQ and this page polls for them (no WebSocket exists). */
export default function Notifications() {
  const { isAdmin } = useAuth()
  const { resource, notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState(false)

  const shown = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications

  async function onMarkAll() {
    setBusy(true)
    await markAllRead()
    setBusy(false)
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={isAdmin ? 'Notifications of all users (administrator view).' : 'Updates about your incidents.'}
        actions={
          <>
            <LiveStatus resource={resource} />
            <Button variant="secondary" size="sm" icon={CheckCheck} onClick={() => void onMarkAll()} loading={busy} disabled={unreadCount === 0}>
              Mark all as read
            </Button>
          </>
        }
      />

      <Card padded={false}>
        <div className="flex gap-1 border-b border-line p-2" role="tablist" aria-label="Notification filter">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${filter === f ? 'bg-panel-2 text-ink' : 'text-mute hover:text-ink'}`}
            >
              {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {resource.loading ? (
          <LoadingState label="Loading notifications..." />
        ) : resource.error && !resource.data ? (
          <ErrorState error={resource.error} onRetry={() => void resource.reload()} title="Could not load notifications" />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            message={filter === 'unread' ? 'You have read everything.' : 'You are notified when a responder is assigned to an incident, or when an incident is waiting for one.'}
          />
        ) : (
          <NotificationList notifications={shown} onMarkRead={(id) => void markRead(id)} />
        )}
      </Card>
    </>
  )
}

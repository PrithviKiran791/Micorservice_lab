import { Link } from 'react-router-dom'
import { Check, Clock3, UserCheck } from 'lucide-react'
import type { AppNotification } from '../../types/api'
import { NOTIFICATION_TYPE_LABEL, formatDateTime, timeAgo } from '../../utils/format'

interface NotificationListProps {
  notifications: AppNotification[]
  onMarkRead: (id: number) => void
  /** Smaller rows for the dashboard preview. */
  compact?: boolean
}

/** Notifications with type, message, incident reference, time and read state. Unread ones are marked with a blue dot. */
export function NotificationList({ notifications, onMarkRead, compact = false }: NotificationListProps) {
  return (
    <ul className="divide-y divide-line">
      {notifications.map((n) => {
        const Icon = n.type === 'INCIDENT_ASSIGNED' ? UserCheck : Clock3
        const tone = n.type === 'INCIDENT_ASSIGNED' ? 'bg-ok/15 text-ok' : 'bg-amber/15 text-amber'
        return (
          <li key={n.id} className={`flex items-start gap-3 ${compact ? 'px-4 py-3' : 'px-5 py-4'} ${n.read ? '' : 'bg-brand/5'}`}>
            <span className={`mt-0.5 rounded-lg p-2 ${tone}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {!n.read && <span className="h-2 w-2 rounded-full bg-brand" aria-label="Unread" />}
                <span className="text-xs font-semibold uppercase tracking-wide text-faint">{NOTIFICATION_TYPE_LABEL[n.type]}</span>
              </div>
              <p className={`mt-1 break-words text-sm ${n.read ? 'text-mute' : 'font-medium text-ink'}`}>{n.message}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                <Link to={`/app/incidents?open=${n.incidentId}`} className="font-medium text-brand hover:underline">
                  Incident #{n.incidentId}
                </Link>
                <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</time>
              </p>
            </div>
            {!n.read && (
              <button
                type="button"
                onClick={() => onMarkRead(n.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-mute transition-colors hover:border-faint hover:text-ink"
                aria-label={`Mark notification ${n.id} as read`}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {compact ? 'Read' : 'Mark read'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useResource, type Resource } from '../hooks/useResource'
import { notificationService } from '../services/notificationService'
import type { AppNotification } from '../types/api'
import { useToast } from './ToastContext'
import { toAppError } from '../services/errors'

interface NotificationsState {
  resource: Resource<AppNotification[]>
  notifications: AppNotification[]
  unreadCount: number
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsState | null>(null)

/**
 * One polling loop for the notification list, shared by the sidebar badge and the Notifications page. Notifications are
 * created asynchronously (incident-service -> RabbitMQ -> notification-service), so they can appear a moment after the
 * incident was reported.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const resource = useResource<AppNotification[]>((signal) => notificationService.list(signal))
  const { notify } = useToast()
  const { data, reload } = resource

  const markRead = useCallback(
    async (id: number) => {
      try {
        await notificationService.markRead(id)
        await reload()
      } catch (e) {
        notify('error', 'Could not mark as read', toAppError(e).message)
      }
    },
    [reload, notify],
  )

  const markAllRead = useCallback(async () => {
    const unread = (data ?? []).filter((n) => !n.read)
    if (unread.length === 0) return
    // The backend has no bulk endpoint, so each unread notification is updated with its own PATCH request.
    const results = await Promise.allSettled(unread.map((n) => notificationService.markRead(n.id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) notify('warning', 'Some notifications could not be updated', `${failed} of ${unread.length} failed.`)
    await reload()
  }, [data, reload, notify])

  const value = useMemo<NotificationsState>(
    () => ({
      resource,
      notifications: data ?? [],
      unreadCount: (data ?? []).filter((n) => !n.read).length,
      markRead,
      markAllRead,
    }),
    [resource, data, markRead, markAllRead],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return ctx
}

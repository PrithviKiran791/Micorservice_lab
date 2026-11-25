import type { AppNotification } from '../types/api'
import { http } from './http'

// /api/notifications. A USER receives their own notifications; an ADMIN receives all (or only their own with mine=true).
// Notifications are created asynchronously from RabbitMQ events, and there is no push channel, so the app polls.
export const notificationService = {
  async list(signal?: AbortSignal): Promise<AppNotification[]> {
    const { data } = await http.get<AppNotification[]>('/notifications', { signal })
    return data
  },

  async markRead(id: number): Promise<AppNotification> {
    const { data } = await http.patch<AppNotification>(`/notifications/${id}/read`)
    return data
  },
}

import type { IncidentStatus, IncidentType, NotificationType, ResponderStatus, ResponderType, Severity } from '../types/api'

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  MEDICAL: 'Medical',
  FIRE: 'Fire',
  POLICE: 'Police',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  CRITICAL: 'Critical',
}

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  REPORTED: 'Reported',
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  RESOLVED: 'Resolved',
}

export const RESPONDER_TYPE_LABEL: Record<ResponderType, string> = {
  AMBULANCE: 'Ambulance',
  FIRE_TRUCK: 'Fire truck',
  POLICE: 'Police unit',
}

export const RESPONDER_STATUS_LABEL: Record<ResponderStatus, string> = {
  AVAILABLE: 'Available',
  BUSY: 'Busy',
  OFFLINE: 'Offline',
}

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  INCIDENT_ASSIGNED: 'Responder assigned',
  INCIDENT_PENDING: 'Waiting for a responder',
}

/** "25 Nov 2026, 14:30" in the browser's time zone. The API sends UTC timestamps (ISO-8601). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '-'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '-'
  const seconds = Math.max(0, Math.round((now - t) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

/** Minutes, hours and seconds left until a given time, for the session timer in Settings. */
export function formatRemaining(untilMs: number, now: number = Date.now()): string {
  const total = Math.max(0, Math.floor((untilMs - now) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min ${s} s`
}

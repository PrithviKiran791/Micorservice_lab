import type {
  Incident,
  IncidentStatus,
  IncidentType,
  Responder,
  ResponderStatus,
  ResponderType,
  Severity,
} from '../types/api'
import { INCIDENT_STATUSES, INCIDENT_TYPES, RESPONDER_STATUSES, RESPONDER_TYPES, SEVERITIES } from '../types/api'

/**
 * The backend has no analytics endpoint. Every number in the dashboards and charts is calculated here from the incident
 * and responder records the API returns (a regular user only receives their own incidents, an administrator receives all).
 */

export interface IncidentSummary {
  total: number
  reported: number
  pending: number
  assigned: number
  resolved: number
  /** Critical incidents that are not resolved yet. */
  openCritical: number
}

export function summarize(incidents: Incident[]): IncidentSummary {
  const summary: IncidentSummary = { total: incidents.length, reported: 0, pending: 0, assigned: 0, resolved: 0, openCritical: 0 }
  for (const i of incidents) {
    if (i.status === 'REPORTED') summary.reported++
    else if (i.status === 'PENDING') summary.pending++
    else if (i.status === 'ASSIGNED') summary.assigned++
    else if (i.status === 'RESOLVED') summary.resolved++
    if (i.severity === 'CRITICAL' && i.status !== 'RESOLVED') summary.openCritical++
  }
  return summary
}

export function countByType(incidents: Incident[]): Record<IncidentType, number> {
  const counts = { MEDICAL: 0, FIRE: 0, POLICE: 0 } as Record<IncidentType, number>
  for (const i of incidents) counts[i.type]++
  return counts
}

export function countBySeverity(incidents: Incident[]): Record<Severity, number> {
  const counts = { LOW: 0, MEDIUM: 0, CRITICAL: 0 } as Record<Severity, number>
  for (const i of incidents) counts[i.severity]++
  return counts
}

export function countByStatus(incidents: Incident[]): Record<IncidentStatus, number> {
  const counts = { REPORTED: 0, PENDING: 0, ASSIGNED: 0, RESOLVED: 0 } as Record<IncidentStatus, number>
  for (const i of incidents) counts[i.status]++
  return counts
}

export interface ResponderAvailability {
  total: number
  byStatus: Record<ResponderStatus, number>
  byType: Record<ResponderType, Record<ResponderStatus, number>>
}

export function responderAvailability(responders: Responder[]): ResponderAvailability {
  const byStatus = { AVAILABLE: 0, BUSY: 0, OFFLINE: 0 } as Record<ResponderStatus, number>
  const byType = {} as Record<ResponderType, Record<ResponderStatus, number>>
  for (const t of RESPONDER_TYPES) byType[t] = { AVAILABLE: 0, BUSY: 0, OFFLINE: 0 }
  for (const r of responders) {
    byStatus[r.status]++
    byType[r.type][r.status]++
  }
  return { total: responders.length, byStatus, byType }
}

export interface ActivityPoint {
  /** Start of the bucket (epoch ms), used for sorting. */
  start: number
  label: string
  count: number
}

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 24 * HOUR

export type Granularity = 'ten minutes' | 'hour' | 'day'

/**
 * Incidents over time, grouped by when they were reported. The bucket size follows the time span so the chart is
 * readable: up to 3 hours -> 10-minute buckets, up to 48 hours -> hours, longer -> days. Empty buckets between the first
 * and the last incident are included so the picture is honest.
 */
export function activityOverTime(incidents: Incident[]): { granularity: Granularity; points: ActivityPoint[] } {
  const times = incidents.map((i) => new Date(i.createdAt).getTime()).filter((t) => !Number.isNaN(t))
  if (times.length === 0) return { granularity: 'day', points: [] }

  const min = Math.min(...times)
  const max = Math.max(...times)
  const span = max - min
  const granularity: Granularity = span <= 3 * HOUR ? 'ten minutes' : span <= 2 * DAY ? 'hour' : 'day'
  const step = granularity === 'ten minutes' ? 10 * MINUTE : granularity === 'hour' ? HOUR : DAY

  const bucketStart = (t: number): number => {
    const d = new Date(t)
    if (granularity === 'ten minutes') d.setMinutes(Math.floor(d.getMinutes() / 10) * 10, 0, 0)
    else if (granularity === 'hour') d.setMinutes(0, 0, 0)
    else d.setHours(0, 0, 0, 0)
    return d.getTime()
  }

  const counts = new Map<number, number>()
  for (const t of times) {
    const b = bucketStart(t)
    counts.set(b, (counts.get(b) ?? 0) + 1)
  }

  const points: ActivityPoint[] = []
  for (let s = bucketStart(min); s <= bucketStart(max); s += step) {
    const d = new Date(s)
    const label = granularity === 'day' ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    points.push({ start: s, label, count: counts.get(s) ?? 0 })
  }
  return { granularity, points }
}
/** Convenience for charts: turns a count record into rows in a fixed order. */
export function toRows<K extends string>(order: readonly K[], counts: Record<K, number>): { key: K; value: number }[] {
  return order.map((key) => ({ key, value: counts[key] }))
}

export { INCIDENT_STATUSES, INCIDENT_TYPES, RESPONDER_STATUSES, RESPONDER_TYPES, SEVERITIES }

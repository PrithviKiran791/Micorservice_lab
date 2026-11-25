import type { IncidentStatus, Severity } from '../types/api'

/** Marker colours. They follow the colours used everywhere else in the interface (red critical, amber medium). */
export const MARKER_COLORS = {
  CRITICAL: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#38bdf8',
  RESOLVED: '#6b7280',
} as const

/** A resolved incident is grey whatever its severity; otherwise the colour is the severity. */
export function markerColor(severity: Severity, status: IncidentStatus): string {
  return status === 'RESOLVED' ? MARKER_COLORS.RESOLVED : MARKER_COLORS[severity]
}

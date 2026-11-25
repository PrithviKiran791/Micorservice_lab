import type { Incident, IncidentStatus, IncidentType, Severity } from '../types/api'

export type SinceFilter = 'ALL' | '1h' | '24h' | '7d'

export interface MapFilterState {
  type: IncidentType | ''
  severity: Severity | ''
  status: IncidentStatus | ''
  /** Reported within the last hour / day / week, using the incident's createdAt. */
  since: SinceFilter
}

export const DEFAULT_MAP_FILTERS: MapFilterState = { type: '', severity: '', status: '', since: 'ALL' }

export const SINCE_OPTIONS: { value: SinceFilter; label: string; ms: number | null }[] = [
  { value: 'ALL', label: 'Any time', ms: null },
  { value: '1h', label: 'Last hour', ms: 3_600_000 },
  { value: '24h', label: 'Last 24 hours', ms: 24 * 3_600_000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 24 * 3_600_000 },
]

export function filtersActive(f: MapFilterState): boolean {
  return f.type !== '' || f.severity !== '' || f.status !== '' || f.since !== 'ALL'
}

export function applyMapFilters(incidents: Incident[], f: MapFilterState, now: number = Date.now()): Incident[] {
  const window = SINCE_OPTIONS.find((o) => o.value === f.since)?.ms ?? null
  return incidents.filter((i) => {
    if (f.type && i.type !== f.type) return false
    if (f.severity && i.severity !== f.severity) return false
    if (f.status && i.status !== f.status) return false
    if (window !== null) {
      const created = new Date(i.createdAt).getTime()
      if (!Number.isFinite(created) || now - created > window) return false
    }
    return true
  })
}

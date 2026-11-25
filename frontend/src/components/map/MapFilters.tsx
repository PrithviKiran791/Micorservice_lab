import { RotateCcw } from 'lucide-react'
import { INCIDENT_STATUSES, INCIDENT_TYPES, SEVERITIES, type IncidentStatus, type IncidentType, type Severity } from '../../types/api'
import { INCIDENT_TYPE_LABEL, SEVERITY_LABEL, STATUS_LABEL } from '../../utils/format'
import { DEFAULT_MAP_FILTERS, filtersActive, SINCE_OPTIONS, type MapFilterState, type SinceFilter } from '../../utils/mapFilters'
import { Button } from '../common/Button'
import { SelectInput } from '../common/FormField'

interface Props {
  value: MapFilterState
  onChange: (next: MapFilterState) => void
  /** "Showing 3 of 12" */
  shown: number
  total: number
}

/** Filters for the map and the lists next to it. Changing any of them immediately changes the visible markers. */
export function MapFilters({ value, onChange, shown, total }: Props) {
  const set = <K extends keyof MapFilterState>(key: K, v: MapFilterState[K]) => onChange({ ...value, [key]: v })
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <SelectInput id="map-type" label="Type" value={value.type} onChange={(e) => set('type', e.target.value as IncidentType | '')}>
          <option value="">All types</option>
          {INCIDENT_TYPES.map((t) => (<option key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</option>))}
        </SelectInput>
        <SelectInput id="map-severity" label="Severity" value={value.severity} onChange={(e) => set('severity', e.target.value as Severity | '')}>
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (<option key={s} value={s}>{SEVERITY_LABEL[s]}</option>))}
        </SelectInput>
        <SelectInput id="map-status" label="Status" value={value.status} onChange={(e) => set('status', e.target.value as IncidentStatus | '')}>
          <option value="">All statuses</option>
          {INCIDENT_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}
        </SelectInput>
        <SelectInput id="map-since" label="Reported" value={value.since} onChange={(e) => set('since', e.target.value as SinceFilter)}>
          {SINCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </SelectInput>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-mute" aria-live="polite">Showing {shown} of {total} incident{total === 1 ? '' : 's'}</p>
        <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => onChange(DEFAULT_MAP_FILTERS)} disabled={!filtersActive(value)}>
          Reset filters
        </Button>
      </div>
    </div>
  )
}

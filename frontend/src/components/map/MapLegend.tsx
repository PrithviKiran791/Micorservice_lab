import { Flame, HeartPulse, Shield } from 'lucide-react'
import { MARKER_COLORS } from '../../utils/mapStyle'

const SEVERITY: [string, string][] = [
  ['Critical', MARKER_COLORS.CRITICAL],
  ['Medium', MARKER_COLORS.MEDIUM],
  ['Low', MARKER_COLORS.LOW],
  ['Resolved', MARKER_COLORS.RESOLVED],
]

/** Explains the marker colours (severity), symbols (type) and badges (status). Shown under the map. */
export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-mute" aria-label="Map legend">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {SEVERITY.map(([label, color]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-night" style={{ backgroundColor: color }} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <li className="flex items-center gap-1.5"><HeartPulse className="h-3.5 w-3.5" aria-hidden="true" /> Medical</li>
        <li className="flex items-center gap-1.5"><Flame className="h-3.5 w-3.5" aria-hidden="true" /> Fire</li>
        <li className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" aria-hidden="true" /> Police</li>
      </ul>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <li className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ok text-[9px] font-bold text-white" aria-hidden="true">&#10003;</span> Assigned</li>
        <li className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-night" aria-hidden="true">!</span> Waiting for a responder</li>
      </ul>
    </div>
  )
}

import type { Responder } from '../../types/api'
import { RESPONDER_TYPES } from '../../types/api'
import { RESPONDER_TYPE_LABEL } from '../../utils/format'
import { responderAvailability } from '../../utils/stats'
import { RESPONDER_TYPE_ICON } from '../common/Badge'

/** For each responder type: how many are available out of all, as a small bar. Calculated from the responder list. */
export function AvailabilitySummary({ responders }: { responders: Responder[] }) {
  const a = responderAvailability(responders)
  return (
    <ul className="space-y-4">
      {RESPONDER_TYPES.map((type) => {
        const counts = a.byType[type]
        const total = counts.AVAILABLE + counts.BUSY + counts.OFFLINE
        const Icon = RESPONDER_TYPE_ICON[type]
        const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100)
        return (
          <li key={type}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2 text-ink">
                <Icon className="h-4 w-4 text-mute" aria-hidden="true" />
                {RESPONDER_TYPE_LABEL[type]}
              </span>
              <span className="text-mute">
                <span className="font-semibold text-ok">{counts.AVAILABLE}</span> of {total} available
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-night" role="img" aria-label={`${counts.AVAILABLE} available, ${counts.BUSY} busy, ${counts.OFFLINE} offline`}>
              <span className="bg-ok" style={{ width: `${pct(counts.AVAILABLE)}%` }} />
              <span className="bg-amber" style={{ width: `${pct(counts.BUSY)}%` }} />
              <span className="bg-slate-500" style={{ width: `${pct(counts.OFFLINE)}%` }} />
            </div>
          </li>
        )
      })}
      <li className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-faint">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok" /> Available</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber" /> Busy</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-500" /> Offline</span>
      </li>
    </ul>
  )
}

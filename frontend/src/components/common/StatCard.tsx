import type { LucideIcon } from 'lucide-react'

export type Tone = 'neutral' | 'critical' | 'amber' | 'ok' | 'info'

const TONES: Record<Tone, { icon: string; value: string }> = {
  neutral: { icon: 'bg-panel-2 text-mute', value: 'text-ink' },
  critical: { icon: 'bg-critical/15 text-critical', value: 'text-critical' },
  amber: { icon: 'bg-amber/15 text-amber', value: 'text-amber' },
  ok: { icon: 'bg-ok/15 text-ok', value: 'text-ok' },
  info: { icon: 'bg-sky/15 text-sky', value: 'text-ink' },
}

/** One headline number with a label. `value` may be a string such as "-" while data is missing. */
export function StatCard({ label, value, icon: Icon, tone = 'neutral', hint }: { label: string; value: number | string; icon: LucideIcon; tone?: Tone; hint?: string }) {
  const t = TONES[tone]
  return (
    <div className="rounded-xl border border-line bg-panel p-4 shadow-sm shadow-black/20">
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">{label}</p>
        <span className={`rounded-lg p-2 ${t.icon}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-3 text-3xl font-semibold tabular-nums ${t.value}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  )
}

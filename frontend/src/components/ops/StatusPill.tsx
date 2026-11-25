import type { ReactNode } from 'react'

const STYLE: Record<string, string> = {
  UP: 'bg-ok/15 text-ok border-ok/30',
  PASS: 'bg-ok/15 text-ok border-ok/30',
  CLOSED: 'bg-ok/15 text-ok border-ok/30',
  DEGRADED: 'bg-amber/15 text-amber border-amber/30',
  PARTIAL: 'bg-amber/15 text-amber border-amber/30',
  HALF_OPEN: 'bg-amber/15 text-amber border-amber/30',
  DOWN: 'bg-critical/15 text-critical border-critical/30',
  OPEN: 'bg-critical/15 text-critical border-critical/30',
  UNREACHABLE: 'bg-critical/15 text-critical border-critical/30',
  FORCED_OPEN: 'bg-critical/15 text-critical border-critical/30',
  UNKNOWN: 'bg-panel-2 text-mute border-line',
  'NOT VERIFIED': 'bg-panel-2 text-mute border-line',
}

const DOT: Record<string, string> = { UP: 'bg-ok', PASS: 'bg-ok', CLOSED: 'bg-ok', DEGRADED: 'bg-amber', PARTIAL: 'bg-amber', HALF_OPEN: 'bg-amber', DOWN: 'bg-critical', OPEN: 'bg-critical', UNREACHABLE: 'bg-critical' }

/** A coloured state label. Unknown values fall back to neutral grey, so an unexpected word is never shown as "healthy". */
export function StatusPill({ state, children }: { state: string; children?: ReactNode }) {
  const style = STYLE[state] ?? STYLE.UNKNOWN
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[state] ?? 'bg-faint'}`} aria-hidden="true" />
      {children ?? state.replace('_', ' ')}
    </span>
  )
}

export type SourceKind = 'live' | 'calculated' | 'historical' | 'design' | 'unavailable'

const SOURCE: Record<SourceKind, { label: string; cls: string; hint: string }> = {
  live: { label: 'Live', cls: 'border-ok/40 text-ok', hint: 'Read from the running system when this page refreshed' },
  calculated: { label: 'Calculated', cls: 'border-sky/40 text-sky', hint: 'Computed in the browser from live API answers' },
  historical: { label: 'Recorded evidence', cls: 'border-amber/40 text-amber', hint: 'A result recorded earlier in the repository, not measured now' },
  design: { label: 'Design', cls: 'border-line text-mute', hint: 'A fact about the architecture, taken from the source code and manifests' },
  unavailable: { label: 'Unavailable', cls: 'border-critical/40 text-critical', hint: 'The source could not be read, so no value is shown' },
}

/** Says where a number or statement comes from, so measured values are never confused with recorded evidence. */
export function SourceTag({ kind, note }: { kind: SourceKind; note?: string }) {
  const s = SOURCE[kind]
  return (
    <span title={note ?? s.hint} className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  )
}

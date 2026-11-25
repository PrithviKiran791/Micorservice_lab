import { Ambulance, CheckCircle2, Clock3, Flame, HeartPulse, Siren, ShieldAlert, UserCheck, type LucideIcon } from 'lucide-react'
import type { IncidentStatus, IncidentType, ResponderStatus, ResponderType, Severity } from '../../types/api'
import { INCIDENT_TYPE_LABEL, RESPONDER_STATUS_LABEL, RESPONDER_TYPE_LABEL, SEVERITY_LABEL, STATUS_LABEL } from '../../utils/format'

/** A small coloured label. The meaning is always carried by the TEXT as well, never by colour alone. */
function Pill({ tone, icon: Icon, children }: { tone: string; icon?: LucideIcon; children: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  )
}

const STATUS_STYLE: Record<IncidentStatus, { tone: string; icon: LucideIcon }> = {
  REPORTED: { tone: 'bg-sky/15 text-sky', icon: Clock3 },
  PENDING: { tone: 'bg-amber/15 text-amber', icon: Clock3 },
  ASSIGNED: { tone: 'bg-ok/15 text-ok', icon: UserCheck },
  RESOLVED: { tone: 'bg-slate-500/20 text-slate-300', icon: CheckCircle2 },
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <Pill tone={s.tone} icon={s.icon}>
      {STATUS_LABEL[status]}
    </Pill>
  )
}

const SEVERITY_TONE: Record<Severity, string> = {
  CRITICAL: 'bg-critical/15 text-critical',
  MEDIUM: 'bg-amber/15 text-amber',
  LOW: 'bg-sky/15 text-sky',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Pill tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Pill>
}

const RESPONDER_STATUS_TONE: Record<ResponderStatus, string> = {
  AVAILABLE: 'bg-ok/15 text-ok',
  BUSY: 'bg-amber/15 text-amber',
  OFFLINE: 'bg-slate-500/20 text-slate-300',
}

export function ResponderStatusBadge({ status }: { status: ResponderStatus }) {
  return <Pill tone={RESPONDER_STATUS_TONE[status]}>{RESPONDER_STATUS_LABEL[status]}</Pill>
}

export const INCIDENT_TYPE_ICON: Record<IncidentType, LucideIcon> = {
  MEDICAL: HeartPulse,
  FIRE: Flame,
  POLICE: ShieldAlert,
}

export const RESPONDER_TYPE_ICON: Record<ResponderType, LucideIcon> = {
  AMBULANCE: Ambulance,
  FIRE_TRUCK: Flame,
  POLICE: Siren,
}

/** Incident type with its icon, e.g. a heart-pulse for medical. */
export function IncidentTypeLabel({ type }: { type: IncidentType }) {
  const Icon = INCIDENT_TYPE_ICON[type]
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink">
      <Icon className="h-4 w-4 text-mute" aria-hidden="true" />
      {INCIDENT_TYPE_LABEL[type]}
    </span>
  )
}

export function ResponderTypeLabel({ type }: { type: ResponderType }) {
  const Icon = RESPONDER_TYPE_ICON[type]
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink">
      <Icon className="h-4 w-4 text-mute" aria-hidden="true" />
      {RESPONDER_TYPE_LABEL[type]}
    </span>
  )
}

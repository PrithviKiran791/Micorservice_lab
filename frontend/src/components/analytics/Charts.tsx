import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Incident, Responder } from '../../types/api'
import { INCIDENT_STATUSES, INCIDENT_TYPES, RESPONDER_TYPES, SEVERITIES } from '../../types/api'
import { INCIDENT_TYPE_LABEL, RESPONDER_TYPE_LABEL, SEVERITY_LABEL, STATUS_LABEL } from '../../utils/format'
import { activityOverTime, countBySeverity, countByStatus, countByType, responderAvailability } from '../../utils/stats'

// One colour language everywhere: red = critical, amber = pending / busy, green = assigned / available, grey = resolved / offline.
const COLORS = {
  critical: '#ef4444',
  amber: '#f59e0b',
  ok: '#22c55e',
  sky: '#38bdf8',
  brand: '#3b82f6',
  slate: '#64748b',
  grid: '#22314f',
  axis: '#8fa0bf',
}

const TOOLTIP = {
  contentStyle: { background: '#15223d', border: '1px solid #22314f', borderRadius: 8, color: '#e6ebf5', fontSize: 13 },
  itemStyle: { color: '#e6ebf5' },
  labelStyle: { color: '#8fa0bf' },
  cursor: { fill: 'rgba(143,160,191,0.08)' },
}

const AXIS = { stroke: COLORS.axis, fontSize: 12, tickLine: false, axisLine: false } as const

/** Fixed-height wrapper so the responsive charts always have room to draw. */
export function ChartFrame({ children, height = 260 }: { children: ReactNode; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}

export function TypeChart({ incidents }: { incidents: Incident[] }) {
  const counts = countByType(incidents)
  const data = INCIDENT_TYPES.map((t) => ({ name: INCIDENT_TYPE_LABEL[t], value: counts[t] }))
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="name" {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="value" name="Incidents" fill={COLORS.brand} radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ChartFrame>
  )
}

const SEVERITY_COLOR = { LOW: COLORS.sky, MEDIUM: COLORS.amber, CRITICAL: COLORS.critical }

export function SeverityChart({ incidents }: { incidents: Incident[] }) {
  const counts = countBySeverity(incidents)
  const data = SEVERITIES.map((s) => ({ key: s, name: SEVERITY_LABEL[s], value: counts[s] }))
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="name" {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="value" name="Incidents" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((d) => (
            <Cell key={d.key} fill={SEVERITY_COLOR[d.key]} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  )
}

const STATUS_COLOR = { REPORTED: COLORS.sky, PENDING: COLORS.amber, ASSIGNED: COLORS.ok, RESOLVED: COLORS.slate }

export function StatusChart({ incidents }: { incidents: Incident[] }) {
  const counts = countByStatus(incidents)
  const data = INCIDENT_STATUSES.map((s) => ({ key: s, name: STATUS_LABEL[s], value: counts[s] })).filter((d) => d.value > 0)
  return (
    <ChartFrame>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none">
          {data.map((d) => (
            <Cell key={d.key} fill={STATUS_COLOR[d.key]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP} />
        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, color: COLORS.axis }} />
      </PieChart>
    </ChartFrame>
  )
}

export function ResponderChart({ responders }: { responders: Responder[] }) {
  const a = responderAvailability(responders)
  const data = RESPONDER_TYPES.map((t) => ({ name: RESPONDER_TYPE_LABEL[t], Available: a.byType[t].AVAILABLE, Busy: a.byType[t].BUSY, Offline: a.byType[t].OFFLINE }))
  return (
    <ChartFrame>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS} />
        <YAxis type="category" dataKey="name" width={96} {...AXIS} />
        <Tooltip {...TOOLTIP} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: COLORS.axis }} />
        <Bar dataKey="Available" stackId="r" fill={COLORS.ok} maxBarSize={28} />
        <Bar dataKey="Busy" stackId="r" fill={COLORS.amber} maxBarSize={28} />
        <Bar dataKey="Offline" stackId="r" fill={COLORS.slate} radius={[0, 6, 6, 0]} maxBarSize={28} />
      </BarChart>
    </ChartFrame>
  )
}

export function ActivityChart({ incidents }: { incidents: Incident[] }) {
  const { granularity, points } = activityOverTime(incidents)
  const data = points.map((p) => ({ name: p.label, Incidents: p.count }))
  return (
    <div>
      <ChartFrame height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="name" {...AXIS} minTickGap={16} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip {...TOOLTIP} />
          <Bar dataKey="Incidents" fill={COLORS.brand} radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ChartFrame>
      <p className="mt-2 text-xs text-faint">Incidents reported per {granularity} ({points.length} bucket{points.length === 1 ? '' : 's'} between the first and the last incident).</p>
    </div>
  )
}
import { useMemo, useState } from 'react'
import { Card } from '../components/common/Card'
import { PageHeader } from '../components/common/PageHeader'
import { SourceTag, StatusPill } from '../components/ops/StatusPill'
import { EDGES, EDGE_STYLE, NODES, type ArchNode, type EdgeKind } from '../data/architecture'
import { useResource } from '../hooks/useResource'
import { opsService } from '../services/opsService'
import type { OpsHealth, OpsKubernetes } from '../types/ops'

/** The point where the line from the centre of `a` to the centre of `b` leaves the rectangle of `a`. */
function anchor(a: ArchNode, b: ArchNode): { x: number; y: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return { x: a.x, y: a.y }
  const sx = dx === 0 ? Infinity : a.w / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : a.h / 2 / Math.abs(dy)
  const s = Math.min(sx, sy)
  return { x: a.x + dx * s, y: a.y + dy * s }
}

/** Current state of a component from the operations API, or null when it is not reported (never guessed). */
function liveState(node: ArchNode, health: OpsHealth | null, k8s: OpsKubernetes | null): string | null {
  const key = node.healthKey
  if (!key || !health) return null
  if (key === 'discovery-service') return health.discovery.health === 'UP' ? 'UP' : 'DOWN'
  if (key === 'rabbitmq') return health.rabbitmq.status
  if (key === 'postgres') {
    const s = health.databases.map((d) => d.status)
    return s.includes('DOWN') ? 'DOWN' : s.length > 0 && s.every((x) => x === 'UP') ? 'UP' : 'UNKNOWN'
  }
  if (key === 'frontend') {
    const d = k8s?.available ? k8s.deployments?.find((x) => x.name === 'frontend') : undefined
    return d ? (d.ready >= d.desired && d.desired > 0 ? 'UP' : 'DOWN') : null
  }
  return health.services.find((s) => s.name === key)?.status ?? null
}

/** Interactive picture of the real system. Click a component to see what it does, what it talks to and its live state. */
export default function Architecture() {
  const health = useResource<OpsHealth>((s) => opsService.health(s))
  const k8s = useResource<OpsKubernetes>((s) => opsService.kubernetes(s))
  const [selectedId, setSelectedId] = useState<string>('gateway')
  const [hidden, setHidden] = useState<Set<EdgeKind>>(new Set())

  const byId = useMemo(() => new Map(NODES.map((n) => [n.id, n])), [])
  const selected = byId.get(selectedId) ?? NODES[0]
  const connected = EDGES.filter((e) => e.from === selected.id || e.to === selected.id)
  const connectedIds = new Set(connected.flatMap((e) => [e.from, e.to]))
  const state = liveState(selected, health.data, k8s.data)

  function toggle(kind: EdgeKind) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  return (
    <>
      <PageHeader title="Architecture" subtitle="The real system: components, how they talk, and what is running. Click a component for details." />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
            {(Object.keys(EDGE_STYLE) as EdgeKind[]).map((kind) => {
              const s = EDGE_STYLE[kind]
              const off = hidden.has(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggle(kind)}
                  aria-pressed={!off}
                  title={s.what}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors ${off ? 'border-line text-faint' : 'border-line text-ink hover:border-faint'}`}
                >
                  <svg width="30" height="8" aria-hidden="true"><line x1="0" y1="4" x2="30" y2="4" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} opacity={off ? 0.3 : 1} /></svg>
                  {s.label}
                </button>
              )
            })}
          </div>

          <svg viewBox="0 0 1000 600" className="block w-full" role="img" aria-label="Architecture diagram of ResQNet Lite">
            <defs>
              {(Object.keys(EDGE_STYLE) as EdgeKind[]).map((kind) => (
                <marker key={kind} id={`arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={EDGE_STYLE[kind].color} />
                </marker>
              ))}
            </defs>

            <rect x="25" y="105" width="950" height="485" rx="14" fill="none" stroke="#22314f" strokeWidth="1.5" strokeDasharray="6 6" />
            <text x="40" y="126" fill="#5d6e8e" fontSize="12">Kubernetes (Minikube) - namespace resqnet</text>

            {EDGES.filter((e) => !hidden.has(e.kind)).map((e) => {
              const a = byId.get(e.from)!
              const b = byId.get(e.to)!
              // database edges run straight down from the service to the database box
              const target = e.kind === 'database' ? { ...b, x: a.x } : b
              const p1 = anchor(a, target)
              const p2 = anchor(b, e.kind === 'database' ? { ...a, y: a.y } : a)
              const end = e.kind === 'database' ? { x: a.x, y: b.y - b.h / 2 } : p2
              const style = EDGE_STYLE[e.kind]
              const active = e.from === selected.id || e.to === selected.id
              return (
                <line
                  key={`${e.from}-${e.to}-${e.kind}`}
                  x1={p1.x} y1={p1.y} x2={end.x} y2={end.y}
                  stroke={style.color} strokeWidth={active ? style.width + 1 : style.width} strokeDasharray={style.dash}
                  opacity={active ? 1 : 0.5} markerEnd={`url(#arrow-${e.kind})`}
                >
                  <title>{`${a.label} -> ${b.label}: ${e.label}`}</title>
                </line>
              )
            })}

            {NODES.map((n) => {
              const isSel = n.id === selected.id
              const near = connectedIds.has(n.id)
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.label}${n.sub ? ' ' + n.sub : ''}`}
                  aria-pressed={isSel}
                  onClick={() => setSelectedId(n.id)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelectedId(n.id) } }}
                  className="cursor-pointer outline-none"
                  opacity={isSel || near ? 1 : 0.85}
                >
                  <rect x={n.x - n.w / 2} y={n.y - n.h / 2} width={n.w} height={n.h} rx="10" fill={isSel ? '#15223d' : '#101a30'} stroke={isSel ? '#3b82f6' : '#2c3f66'} strokeWidth={isSel ? 2.5 : 1.5} />
                  <text x={n.x} y={n.sub ? n.y - 3 : n.y + 5} textAnchor="middle" fill="#e6ebf5" fontSize="14" fontWeight="600">{n.label}</text>
                  {n.sub && <text x={n.x} y={n.y + 15} textAnchor="middle" fill="#8fa0bf" fontSize={n.id === 'postgres' ? 11 : 11}>{n.sub}</text>}
                </g>
              )
            })}
          </svg>
          <p className="border-t border-line px-4 py-3 text-xs text-faint">
            The highlighted lines belong to the selected component. Use the legend buttons to hide a kind of connection. Pods for the API gateway and the incident service run as two replicas.
          </p>
        </Card>

        <Card
          title={selected.label}
          subtitle={selected.sub}
          actions={
            state ? <StatusPill state={state} /> : <SourceTag kind="unavailable" note="The operations API does not report a live state for this component" />
          }
        >
          <p className="text-sm text-mute">{selected.responsibility}</p>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">Technology</h3>
          <p className="mt-1 text-sm text-ink">{selected.technology}</p>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">Endpoints</h3>
          <ul className="mt-1 space-y-0.5 text-sm text-ink">
            {selected.endpoints.map((e) => (<li key={e} className="break-words">{e}</li>))}
          </ul>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">Connected to</h3>
          <ul className="mt-1 space-y-2 text-sm">
            {connected.map((e) => {
              const otherId = e.from === selected.id ? e.to : e.from
              const other = byId.get(otherId)!
              const s = EDGE_STYLE[e.kind]
              return (
                <li key={`${e.from}-${e.to}-${e.kind}`}>
                  <button type="button" onClick={() => setSelectedId(otherId)} className="flex w-full items-start gap-2 text-left hover:text-ink">
                    <svg width="26" height="10" className="mt-1.5 shrink-0" aria-hidden="true"><line x1="0" y1="5" x2="26" y2="5" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} /></svg>
                    <span>
                      <span className="text-ink">{e.from === selected.id ? 'to' : 'from'} {other.label}</span>
                      <span className="block text-xs text-mute">{s.label}: {e.label}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-4 text-xs text-faint">{state ? 'Live state read by the gateway just now.' : 'Design information from the source code and manifests.'}</p>
        </Card>
      </div>
    </>
  )
}

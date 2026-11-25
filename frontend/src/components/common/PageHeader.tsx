import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import type { Resource } from '../../hooks/useResource'
import { timeAgo } from '../../utils/format'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="glass-card mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-200/85">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** "Updated 5 s ago" with a refresh button. Makes it visible that the page refreshes by polling. */
export function LiveStatus({ resource }: { resource: Pick<Resource<unknown>, 'lastUpdated' | 'refreshing' | 'reload'> }) {
  return (
    <button
      type="button"
      onClick={() => void resource.reload()}
      className="glass-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-white/30 hover:text-white"
      title="Refresh now"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${resource.refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
      {resource.lastUpdated ? `Updated ${timeAgo(new Date(resource.lastUpdated).toISOString())}` : 'Loading...'}
    </button>
  )
}

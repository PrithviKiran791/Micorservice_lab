import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, RefreshCw, ServerCrash, WifiOff, type LucideIcon } from 'lucide-react'
import type { AppError } from '../../services/errors'
import { Button } from './Button'

/** Shown while a page loads its data for the first time. */
export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-12 text-mute" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

/** Shown when a list is empty. Never used to hide an error. */
export function EmptyState({ icon: Icon = Inbox, title, message, action }: { icon?: LucideIcon; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span className="mb-3 rounded-full border border-line bg-panel-2 p-3 text-mute">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-mute">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Shown when a request failed. Explains what happened in plain words and offers a retry. */
export function ErrorState({ error, onRetry, title }: { error: AppError; onRetry?: () => void; title?: string }) {
  const unavailable = error.status === 503
  const Icon = error.network ? WifiOff : unavailable ? ServerCrash : AlertTriangle
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center" role="alert">
      <span className={`mb-3 rounded-full border p-3 ${unavailable ? 'border-amber/40 bg-amber/10 text-amber' : 'border-critical/40 bg-critical/10 text-critical'}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-ink">{title ?? (unavailable ? 'Service unavailable' : 'Could not load this data')}</p>
      <p className="mt-1 max-w-md text-sm text-mute">{error.message}</p>
      {onRetry && (
        <Button className="mt-4" variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/** A slim warning strip for partial failures ("responders are unavailable"), shown above the rest of a working page. */
export function InlineNotice({ tone = 'warning', title, children }: { tone?: 'warning' | 'info'; title: string; children?: ReactNode }) {
  const styles = tone === 'warning' ? 'border-amber/40 bg-amber/10 text-amber' : 'border-sky/40 bg-sky/10 text-sky'
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${styles}`} role="status">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-ink/80">{children}</div>}
      </div>
    </div>
  )
}

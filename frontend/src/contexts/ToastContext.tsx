import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
}

interface ToastApi {
  notify: (kind: ToastKind, title: string, message?: string) => void
}

const ToastContext = createContext<ToastApi>({ notify: () => undefined })

const STYLES: Record<ToastKind, { icon: typeof Info; accent: string }> = {
  success: { icon: CheckCircle2, accent: 'text-ok' },
  error: { icon: XCircle, accent: 'text-critical' },
  warning: { icon: AlertTriangle, accent: 'text-amber' },
  info: { icon: Info, accent: 'text-sky' },
}

/** Short messages in the corner ("Incident reported", "Dispatch failed"). They disappear by themselves after 6 seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const notify = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-3), { id, kind, title, message }])
      window.setTimeout(() => dismiss(id), 6000)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const { icon: Icon, accent } = STYLES[t.kind]
          return (
            <div key={t.id} role="status" className="rq-fade-in pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-panel-2 p-3 shadow-lg shadow-black/40">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${accent}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.message && <p className="mt-0.5 break-words text-sm text-mute">{t.message}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded p-1 text-mute hover:text-ink" aria-label="Dismiss message">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  return useContext(ToastContext)
}

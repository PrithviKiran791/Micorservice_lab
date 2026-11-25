import type { ReactNode } from 'react'

interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Set to false for tables that should touch the card edges. */
  padded?: boolean
}

/** The basic surface of the interface: a bordered panel with an optional header row. */
export function Card({ title, subtitle, actions, children, className = '', padded = true }: CardProps) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/12 bg-panel/65 backdrop-blur-xl shadow-[0_8px_32px_rgba(2,6,23,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-mute">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

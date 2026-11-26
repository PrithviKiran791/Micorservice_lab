/** The AegisFlow mark: a red shield with a white cross, next to the wordmark. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#0b1427" />
        <path d="M16 5l9 3.4v7.2c0 5.2-3.7 9.2-9 11.4-5.3-2.2-9-6.2-9-11.4V8.4L16 5z" fill="#ef4444" />
        <path d="M16 10.5v10M11 15.5h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-base font-semibold tracking-tight text-ink">AegisFlow</span>
          <span className="block text-[11px] uppercase tracking-wider text-faint">Emergency operations</span>
        </span>
      )}
    </span>
  )
}

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const CONTROL =
  'w-full rounded-md border bg-night px-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-brand disabled:cursor-not-allowed disabled:opacity-60'

interface FieldShellProps {
  id: string
  label: string
  error?: string
  hint?: ReactNode
  children: ReactNode
}

/** Label + control + hint/error text, wired together for screen readers. */
function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-critical" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>
      )}
    </div>
  )
}

interface CommonProps {
  id: string
  label: string
  error?: string
  hint?: ReactNode
}

export function TextInput({ id, label, error, hint, className = '', ...rest }: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className={`${CONTROL} h-10 ${error ? 'border-critical' : 'border-line'} ${className}`} {...rest} />
    </FieldShell>
  )
}

export function SelectInput({ id, label, error, hint, className = '', children, ...rest }: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className={`${CONTROL} h-10 ${error ? 'border-critical' : 'border-line'} ${className}`} {...rest}>
        {children}
      </select>
    </FieldShell>
  )
}

export function TextArea({ id, label, error, hint, className = '', ...rest }: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <textarea id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className={`${CONTROL} min-h-28 py-2 ${error ? 'border-critical' : 'border-line'} ${className}`} {...rest} />
    </FieldShell>
  )
}

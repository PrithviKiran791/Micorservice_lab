import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Network, ShieldCheck, Siren } from 'lucide-react'
import { Logo } from '../common/Logo'

/** Two-column frame for login and registration: the form on the left, a short explanation on the right (desktop only). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="ResQNet Lite home">
            <Logo />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-mute">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>

        <p className="text-center text-xs text-faint">A college project simulation. Not a real emergency service.</p>
      </div>

      <aside className="hidden flex-col justify-center border-l border-line bg-panel px-12 lg:flex">
        <div className="mx-auto max-w-md space-y-8">
          <h2 className="text-xl font-semibold text-ink">Report, dispatch and track emergencies in one place.</h2>
          <ul className="space-y-6 text-sm">
            <li className="flex gap-4">
              <Siren className="mt-0.5 h-5 w-5 shrink-0 text-critical" aria-hidden="true" />
              <span>
                <strong className="block font-medium text-ink">Reporters</strong>
                <span className="text-mute">Report an emergency and watch its status change from pending to assigned.</span>
              </span>
            </li>
            <li className="flex gap-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden="true" />
              <span>
                <strong className="block font-medium text-ink">Dispatchers</strong>
                <span className="text-mute">See every incident, retry pending ones, resolve finished ones and watch responder availability.</span>
              </span>
            </li>
            <li className="flex gap-4">
              <Network className="mt-0.5 h-5 w-5 shrink-0 text-sky" aria-hidden="true" />
              <span>
                <strong className="block font-medium text-ink">Secured at the gateway</strong>
                <span className="text-mute">Every request is checked for a valid token before it reaches any service.</span>
              </span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

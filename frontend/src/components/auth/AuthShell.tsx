import type { ReactNode } from 'react'
import { Network, ShieldCheck, Siren } from 'lucide-react'
import { PublicNavbar } from '../layout/PublicNavbar'
import { CloudShader } from '../ui/cloud-shader'

/** Glassmorphic two-column frame for login and registration over the animated CloudShader sky. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <CloudShader
        className="!fixed inset-0 -z-20 h-full w-full min-h-screen"
        speed={1}
        count={6}
        cloudColor="#fbf8f2"
        skyTopColor="#3876ba"
        skyBottomColor="#8cbfe8"
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-slate-950/25 via-slate-950/10 to-slate-950/60"
        aria-hidden="true"
      />

      <PublicNavbar variant="auth" />

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:py-12">
        <section className="glass-panel mx-auto w-full max-w-md rounded-3xl p-7 sm:p-9 lg:max-w-none">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300/90">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <p className="mt-7 text-center text-xs text-slate-300/70">
            A college project simulation. Not a real emergency service.
          </p>
        </section>

        <aside className="glass-panel hidden rounded-3xl p-8 lg:block">
          <span className="glass-pill inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky">
            ResQNet Operations
          </span>
          <h2 className="mt-3 text-xl font-semibold leading-snug text-white">
            Report, dispatch and track emergencies in one place.
          </h2>
          <ul className="mt-6 space-y-4 text-sm">
            <li className="glass-card flex gap-4 rounded-2xl p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-critical/35 bg-critical/15 text-critical">
                <Siren className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <strong className="block font-medium text-white">Reporters</strong>
                <span className="text-slate-300/85">Report an emergency and watch its status change from pending to assigned.</span>
              </span>
            </li>
            <li className="glass-card flex gap-4 rounded-2xl p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ok/35 bg-ok/15 text-ok">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <strong className="block font-medium text-white">Dispatchers</strong>
                <span className="text-slate-300/85">See every incident, retry pending ones, resolve finished ones and watch responder availability.</span>
              </span>
            </li>
            <li className="glass-card flex gap-4 rounded-2xl p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky/35 bg-sky/15 text-sky">
                <Network className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <strong className="block font-medium text-white">Secured at the gateway</strong>
                <span className="text-slate-300/85">Every request is checked for a valid token before it reaches any service.</span>
              </span>
            </li>
          </ul>
        </aside>
      </main>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { ArrowRight, Bell, ClipboardList, Network, ShieldCheck, Siren, Truck, Workflow, type LucideIcon } from 'lucide-react'
import { Logo } from '../components/common/Logo'
import { PublicNavbar } from '../components/layout/PublicNavbar'
import { homeFor } from '../components/layout/navigation'
import { CloudShader } from '../components/ui/cloud-shader'
import { HoverBorderGradient } from '../components/ui/hover-border-gradient'
import { useAuth } from '../contexts/AuthContext'

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Siren, title: 'Report in seconds', text: 'Describe a medical, fire or police emergency with its severity and location. The system saves it immediately.' },
  { icon: Truck, title: 'Automatic assignment', text: 'A responder of the right type is assigned automatically, and a responder can never be given to two incidents at once.' },
  { icon: Workflow, title: 'Keeps working under failure', text: 'If the responder service is down, the incident is still accepted as pending and dispatched as soon as help is available.' },
  { icon: Bell, title: 'Asynchronous notifications', text: 'Status changes are delivered as events through a message broker, so notifying never slows down dispatching.' },
  { icon: ShieldCheck, title: 'Secured at the gateway', text: 'Every request is checked for a valid token at one entry point. Dispatcher actions are limited to administrators.' },
  { icon: Network, title: 'Built from microservices', text: 'Separate services with their own databases, service discovery and load balancing, running on Kubernetes.' },
]

const STEPS = [
  { title: 'Report', text: 'A reporter submits an emergency with type, severity, description and location.' },
  { title: 'Assign', text: 'The incident service asks the responder service for a free responder of the matching type.' },
  { title: 'Notify', text: 'An event is published and the reporter receives a notification about the outcome.' },
  { title: 'Resolve', text: 'A dispatcher follows the incident and resolves it, which frees the responder again.' },
]

const TECH = ['Spring Boot', 'Spring Cloud Gateway', 'Netflix Eureka', 'PostgreSQL', 'RabbitMQ', 'Resilience4j', 'Docker', 'Kubernetes']

export default function Landing() {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="relative min-h-screen overflow-x-clip">
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

      <PublicNavbar variant="landing" />

      <main>
        <section className="mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
          <div className="glass-panel rounded-3xl p-7 sm:p-10">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
              Coordinate emergency response, even when parts of the system fail.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200/90 sm:text-lg">
              AegisFlow connects people who report emergencies with the dispatchers and responders who handle them. Incidents are never lost: if no
              responder is reachable, they wait in the queue and are dispatched as soon as one is.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <HoverBorderGradient
                as={Link}
                to={isAuthenticated ? homeFor(user?.role) : '/register'}
                containerClassName="rounded-full"
                className="h-11 px-6 text-sm font-semibold"
              >
                <span>{isAuthenticated ? 'Open dashboard' : 'Create an account'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </HoverBorderGradient>
              {!isAuthenticated && (
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center rounded-full border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-md transition hover:border-white/30 hover:bg-white/20"
                >
                  Log in
                </Link>
              )}
            </div>
            <p className="mt-6 text-xs text-slate-300/75">
              A college Microservices Lab project: a simulation, not a real emergency service. In a real emergency call your local emergency number.
            </p>
          </div>

          {/* The life of an incident, drawn from the real status values of the system (no sample numbers). */}
          <div className="glass-panel rounded-3xl p-6 sm:p-7" aria-label="Life of an incident">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">The life of an incident</p>
              <span className="glass-pill rounded-full px-2.5 py-0.5 text-[11px] font-medium text-sky">Live state flow</span>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="glass-card flex items-center gap-3 rounded-xl px-4 py-3.5 transition hover:border-white/25">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky/30 bg-sky/15 text-sky">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex-1 font-medium text-ink">Reported</span>
                <span className="rounded-full border border-sky/30 bg-sky/15 px-2.5 py-0.5 text-xs font-semibold text-sky">saved</span>
              </li>
              <li className="glass-card flex items-center gap-3 rounded-xl px-4 py-3.5 transition hover:border-white/25">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ok/30 bg-ok/15 text-ok">
                  <Truck className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex-1 font-medium text-ink">Responder found</span>
                <span className="rounded-full border border-ok/30 bg-ok/15 px-2.5 py-0.5 text-xs font-semibold text-ok">Assigned</span>
              </li>
              <li className="glass-card flex items-center gap-3 rounded-xl border-amber/35 px-4 py-3.5 transition hover:border-amber/55">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber/35 bg-amber/15 text-amber">
                  <Workflow className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex-1 font-medium text-ink">No responder reachable</span>
                <span className="rounded-full border border-amber/30 bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber">Pending</span>
              </li>
              <li className="glass-card flex items-center gap-3 rounded-xl px-4 py-3.5 transition hover:border-white/25">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-slate-200">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex-1 font-medium text-ink">Handled by a dispatcher</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-slate-200">Resolved</span>
              </li>
            </ol>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="glass-panel rounded-3xl p-7 sm:p-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="glass-pill inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky">
                  Capabilities
                </span>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">What it does</h2>
              </div>
              <p className="max-w-md text-sm text-slate-300/85">
                Fault-tolerant dispatch built with isolated databases, event messaging, and circuit-breaker resilience.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="glass-card rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/25"
                >
                  <span className="inline-flex rounded-xl border border-sky/25 bg-sky/15 p-2.5 text-sky">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300/85">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="glass-panel rounded-3xl p-7 sm:p-10">
            <span className="glass-pill inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky">
              Dispatch pipeline
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">How it works</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className="glass-card rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/25"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/40 bg-brand/20 text-sm font-semibold text-sky">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-white">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300/85">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="glass-panel rounded-3xl p-7 sm:p-10">
            <span className="glass-pill inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky">
              Architecture
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">The platform underneath</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300/90">
              Six Spring Boot services behind one API gateway, each with its own database, running as pods on Kubernetes.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {TECH.map((t) => (
                <li key={t} className="glass-pill rounded-full px-4 py-1.5 text-sm font-medium text-white">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pt-4 pb-8 sm:px-6">
        <div className="glass-nav flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm text-slate-300/80">
          <Logo compact />
          <p>AegisFlow - Coordinating Response. Protecting Lives. A Microservices Lab project and learning simulation.</p>
        </div>
      </footer>
    </div>
  )
}

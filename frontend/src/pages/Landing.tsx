import { Link } from 'react-router-dom'
import { ArrowRight, Bell, ClipboardList, Network, ShieldCheck, Siren, Truck, Workflow, type LucideIcon } from 'lucide-react'
import { Logo } from '../components/common/Logo'
import { homeFor } from '../components/layout/navigation'
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
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-mute md:flex" aria-label="Page sections">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#platform" className="hover:text-ink">Platform</a>
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to={homeFor(user?.role)} className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600">
                Open dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-ink hover:bg-panel-2">Log in</Link>
                <Link to="/register" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600">Register</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-critical/40 bg-critical/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-critical">
            <span className="h-1.5 w-1.5 rounded-full bg-critical" aria-hidden="true" />
            Emergency response platform
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">Coordinate emergency response, even when parts of the system fail.</h1>
          <p className="mt-5 max-w-xl text-lg text-mute">
            ResQNet Lite connects people who report emergencies with the dispatchers and responders who handle them. Incidents are never lost: if no responder is
            reachable, they wait in the queue and are dispatched as soon as one is.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={isAuthenticated ? homeFor(user?.role) : '/register'} className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-600">
              {isAuthenticated ? 'Open dashboard' : 'Create an account'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {!isAuthenticated && (
              <Link to="/login" className="inline-flex h-11 items-center rounded-md border border-line px-6 text-sm font-semibold text-ink hover:border-faint">Log in</Link>
            )}
          </div>
          <p className="mt-6 text-xs text-faint">A college Microservices Lab project: a simulation, not a real emergency service. In a real emergency call your local emergency number.</p>
        </div>

        {/* The life of an incident, drawn from the real status values of the system (no sample numbers). */}
        <div className="rounded-xl border border-line bg-panel p-6 shadow-xl shadow-black/30" aria-label="Life of an incident">
          <p className="mb-4 text-sm font-semibold text-ink">The life of an incident</p>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3 rounded-lg border border-line bg-night px-4 py-3"><ClipboardList className="h-5 w-5 text-sky" aria-hidden="true" /><span className="flex-1 text-ink">Reported</span><span className="rounded-full bg-sky/15 px-2.5 py-0.5 text-xs font-semibold text-sky">saved</span></li>
            <li className="flex items-center gap-3 rounded-lg border border-line bg-night px-4 py-3"><Truck className="h-5 w-5 text-ok" aria-hidden="true" /><span className="flex-1 text-ink">Responder found</span><span className="rounded-full bg-ok/15 px-2.5 py-0.5 text-xs font-semibold text-ok">Assigned</span></li>
            <li className="flex items-center gap-3 rounded-lg border border-amber/30 bg-night px-4 py-3"><Workflow className="h-5 w-5 text-amber" aria-hidden="true" /><span className="flex-1 text-ink">No responder reachable</span><span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber">Pending</span></li>
            <li className="flex items-center gap-3 rounded-lg border border-line bg-night px-4 py-3"><ShieldCheck className="h-5 w-5 text-slate-300" aria-hidden="true" /><span className="flex-1 text-ink">Handled by a dispatcher</span><span className="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-xs font-semibold text-slate-300">Resolved</span></li>
          </ol>
        </div>
      </section>

      <section id="features" className="border-t border-line bg-panel/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">What it does</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-line bg-panel p-5">
                <span className="inline-flex rounded-lg bg-panel-2 p-2.5 text-sky"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-4 font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm text-mute">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">How it works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-line bg-panel p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/15 text-sm font-semibold text-brand">{i + 1}</span>
              <h3 className="mt-3 font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm text-mute">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="platform" className="border-t border-line bg-panel/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">The platform underneath</h2>
          <p className="mt-2 max-w-2xl text-sm text-mute">Six Spring Boot services behind one API gateway, each with its own database, running as pods on Kubernetes.</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {TECH.map((t) => (
              <li key={t} className="rounded-full border border-line bg-panel px-3.5 py-1.5 text-sm text-ink">{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-faint sm:px-6">
          <Logo compact />
          <p>ResQNet Lite - Microservices Lab project. A simulation for learning.</p>
        </div>
      </footer>
    </div>
  )
}

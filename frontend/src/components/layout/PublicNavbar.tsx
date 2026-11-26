import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Menu, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Logo } from '../common/Logo'
import { HoverBorderGradient } from '../ui/hover-border-gradient'
import { homeFor } from './navigation'

interface PublicNavbarProps {
  variant?: 'landing' | 'auth'
}

const LANDING_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#platform', label: 'Platform' },
]

/** Floating glassmorphic navigation bar shared by the landing and authentication pages. */
export function PublicNavbar({ variant = 'landing' }: PublicNavbarProps) {
  const { isAuthenticated, user } = useAuth()
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-3 z-30 mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="glass-nav flex h-16 items-center justify-between gap-4 rounded-2xl px-4 sm:px-5">
        <Link to="/" aria-label="AegisFlow home" className="shrink-0">
          <Logo />
        </Link>

        {variant === 'landing' ? (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Page sections">
            {LANDING_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : (
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Authentication navigation">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Home
            </Link>
            <Link
              to="/login"
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                pathname === '/login'
                  ? 'border border-white/20 bg-white/15 text-white shadow-inner'
                  : 'text-ink/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                pathname === '/register'
                  ? 'border border-white/20 bg-white/15 text-white shadow-inner'
                  : 'text-ink/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              Register
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-2">
          {variant === 'landing' ? (
            isAuthenticated ? (
              <HoverBorderGradient
                as={Link}
                to={homeFor(user?.role)}
                containerClassName="rounded-full"
                className="h-9 px-4 text-sm font-semibold"
              >
                <span>Open dashboard</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </HoverBorderGradient>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden h-10 items-center rounded-xl border border-white/15 bg-white/8 px-4 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/15 sm:inline-flex"
                >
                  Log in
                </Link>
                <HoverBorderGradient
                  as={Link}
                  to="/register"
                  containerClassName="rounded-full"
                  className="h-9 px-4 text-sm font-semibold"
                >
                  <span>Register</span>
                </HoverBorderGradient>
              </>
            )
          ) : (
            <Link
              to="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3 text-sm font-medium text-white transition hover:bg-white/15 sm:hidden"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Home
            </Link>
          )}

          {variant === 'landing' && (
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-ink transition hover:bg-white/15 md:hidden"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {variant === 'landing' && mobileOpen && (
        <div className="glass-panel rq-fade-in mt-2 flex flex-col gap-1 rounded-2xl p-3 md:hidden">
          {LANDING_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink/90 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </a>
          ))}
          {!isAuthenticated && (
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="mt-1 rounded-xl border border-white/15 bg-white/8 px-3.5 py-2.5 text-center text-sm font-medium text-white transition hover:bg-white/15 sm:hidden"
            >
              Log in
            </Link>
          )}
        </div>
      )}
    </header>
  )
}

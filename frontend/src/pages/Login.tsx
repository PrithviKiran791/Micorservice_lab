import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { AuthShell } from '../components/auth/AuthShell'
import { Button } from '../components/common/Button'
import { TextInput } from '../components/common/FormField'
import { InlineNotice } from '../components/common/States'
import { homeFor } from '../components/layout/navigation'
import { useAuth } from '../contexts/AuthContext'
import { toAppError } from '../services/errors'

export default function Login() {
  const { login, sessionExpired, dismissExpiredNotice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const usernameError = touched && username.trim() === '' ? 'Enter your username.' : undefined
  const passwordError = touched && password === '' ? 'Enter your password.' : undefined

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (username.trim() === '' || password === '') return
    setSubmitting(true)
    try {
      const user = await login(username.trim(), password)
      // go back to the page the visitor originally wanted, otherwise to the home page of their role
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from.startsWith('/app') && from !== '/app' ? from : homeFor(user.role), { replace: true })
    } catch (err) {
      setError(toAppError(err).message)
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Use your ResQNet account to report incidents or manage dispatch.">
      {sessionExpired && (
        <div className="mb-5" onClick={dismissExpiredNotice}>
          <InlineNotice title="Your session ended">For your security you were signed out. Please sign in again.</InlineNotice>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextInput id="username" label="Username" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} error={usernameError} maxLength={50} />

        <div>
          <div className="relative">
            <TextInput id="password" label="Password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={passwordError} maxLength={72} className="pr-11" />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-[33px] rounded p-1 text-mute hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" loading={submitting} icon={LogIn}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-mute">
        New here?{' '}
        <Link to="/register" className="font-medium text-brand hover:underline">
          Create a reporter account
        </Link>
      </p>
    </AuthShell>
  )
}

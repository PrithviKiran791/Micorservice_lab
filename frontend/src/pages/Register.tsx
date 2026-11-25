import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import { AuthShell } from '../components/auth/AuthShell'
import { TextInput } from '../components/common/FormField'
import { homeFor } from '../components/layout/navigation'
import { HoverBorderGradient } from '../components/ui/hover-border-gradient'
import { useAuth } from '../contexts/AuthContext'
import { toAppError } from '../services/errors'
import { validatePassword, validateUsername } from '../utils/validation'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [usernameTaken, setUsernameTaken] = useState(false)
  const [touched, setTouched] = useState(false)

  const usernameError = usernameTaken ? 'That username is already taken.' : touched ? validateUsername(username) : undefined
  const passwordError = touched ? validatePassword(password) : undefined
  const confirmError = touched && confirm !== password ? 'The two passwords do not match.' : undefined

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setServerError(null)
    if (validateUsername(username) || validatePassword(password) || confirm !== password) return
    setSubmitting(true)
    try {
      const user = await register(username.trim(), password)
      navigate(homeFor(user.role), { replace: true })
    } catch (err) {
      const appError = toAppError(err)
      if (appError.code === 'USERNAME_TAKEN') setUsernameTaken(true)
      else setServerError(appError.details.length > 0 ? appError.details.map((d) => `${d.field}: ${d.message}`).join(' ') : appError.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Reporter accounts can report emergencies and follow their progress. Dispatcher accounts are created by the system administrator.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextInput
          id="username"
          label="Username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setUsernameTaken(false)
          }}
          error={usernameError}
          hint="3-50 characters: letters, digits, _ . -"
          maxLength={50}
          className="glass-input rounded-xl"
        />

        <div className="relative">
          <TextInput id="password" label="Password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={passwordError} hint="8-72 characters" maxLength={72} className="glass-input rounded-xl pr-11" />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2.5 top-[33px] rounded-lg p-1 text-mute transition hover:bg-white/10 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <TextInput id="confirm" label="Confirm password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={confirmError} maxLength={72} className="glass-input rounded-xl" />

        {serverError && (
          <p className="rounded-xl border border-critical/40 bg-critical/15 px-3.5 py-2.5 text-sm text-red-200 backdrop-blur-md" role="alert">
            {serverError}
          </p>
        )}

        <HoverBorderGradient
          as="button"
          type="submit"
          disabled={submitting}
          containerClassName="w-full rounded-xl"
          className="h-10 w-full text-sm font-semibold"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
          <span>{submitting ? 'Creating account...' : 'Create account'}</span>
        </HoverBorderGradient>
      </form>

      <p className="mt-6 text-center text-sm text-slate-300/85">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-sky hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}

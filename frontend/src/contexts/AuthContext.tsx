import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authService } from '../services/authService'
import { UNAUTHORIZED_EVENT } from '../services/http'
import { tokenStore, type Session } from '../services/tokenStore'
import type { AuthUser } from '../types/api'
import { getTokenExpiryMs } from '../utils/jwt'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** When the current token stops being valid (epoch ms), or null when signed out. */
  expiresAt: number | null
  /** True after an automatic sign-out caused by an expired or rejected token (the login page shows a notice). */
  sessionExpired: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  /** Creates a reporter account (the backend always assigns the role USER) and signs the user in. */
  register: (username: string, password: string) => Promise<AuthUser>
  logout: () => void
  dismissExpiredNotice: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => tokenStore.get())
  const [sessionExpired, setSessionExpired] = useState(false)

  const logout = useCallback(() => {
    tokenStore.clear()
    setSession(null)
  }, [])

  const expire = useCallback(() => {
    tokenStore.clear()
    setSession(null)
    setSessionExpired(true)
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<AuthUser> => {
    const response = await authService.login(username, password)
    const expiresAt = getTokenExpiryMs(response.token) ?? Date.now() + response.expiresInSeconds * 1000
    const next: Session = { token: response.token, user: response.user, expiresAt }
    tokenStore.set(next)
    setSessionExpired(false)
    setSession(next)
    return response.user
  }, [])

  const register = useCallback(
    async (username: string, password: string): Promise<AuthUser> => {
      await authService.register(username, password)
      return login(username, password)
    },
    [login],
  )

  // Sign out automatically when the token expires.
  useEffect(() => {
    if (!session) return
    const remaining = session.expiresAt - Date.now()
    if (remaining <= 0) {
      expire()
      return
    }
    const timer = window.setTimeout(expire, Math.min(remaining, 2_000_000_000))
    return () => window.clearTimeout(timer)
  }, [session, expire])

  // The HTTP client reports a 401 on a protected call (the backend decided the token is not valid any more).
  useEffect(() => {
    const onUnauthorized = () => {
      if (tokenStore.get()) expire()
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [expire])

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isAdmin: session?.user.role === 'ADMIN',
      expiresAt: session?.expiresAt ?? null,
      sessionExpired,
      login,
      register,
      logout,
      dismissExpiredNotice: () => setSessionExpired(false),
    }),
    [session, sessionExpired, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

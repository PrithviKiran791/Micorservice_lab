import type { AuthUser } from '../types/api'

/**
 * Keeps the login session. The backend contract is "Authorization: Bearer <jwt>" only (no cookies), so the token has to
 * live in the browser. It is kept in sessionStorage: it disappears when the tab is closed and is never written to
 * localStorage, to the URL or to the console. (Any script on the page could read it, which is why the app avoids
 * innerHTML and renders all user text as plain text.)
 */
export interface Session {
  token: string
  user: AuthUser
  /** Epoch milliseconds when the token stops being valid (from the token's own "exp" claim). */
  expiresAt: number
}

const KEY = 'resqnet.session'

export const tokenStore = {
  get(): Session | null {
    try {
      const raw = sessionStorage.getItem(KEY)
      if (!raw) return null
      const session = JSON.parse(raw) as Session
      if (!session.token || !session.user || Date.now() >= session.expiresAt) {
        sessionStorage.removeItem(KEY)
        return null
      }
      return session
    } catch {
      return null
    }
  },

  set(session: Session): void {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(session))
    } catch {
      // storage can be blocked (private mode); the in-memory React state still works until a refresh
    }
  },

  clear(): void {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      /* nothing to clear */
    }
  },

  getToken(): string | null {
    return this.get()?.token ?? null
  },
}

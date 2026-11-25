/**
 * Reads the expiry time from a JWT for user-interface purposes only (to log the user out when the token expires).
 * The signature is NOT checked here: only the API gateway verifies tokens, and the backend stays the authority.
 */
export function getTokenExpiryMs(token: string): number | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded)) as { exp?: unknown }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

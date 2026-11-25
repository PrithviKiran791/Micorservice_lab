import axios from 'axios'
import { toAppError } from './errors'
import { servedBy } from './servedBy'
import { tokenStore } from './tokenStore'

/** Fired when the backend says the token is no longer valid, so the auth context can sign the user out. */
export const UNAUTHORIZED_EVENT = 'resqnet:unauthorized'

/**
 * The single Axios client of the application. EVERY request goes to the API gateway (the only public entry point of the
 * backend). The base URL comes from the environment and defaults to "/api", which works locally (the Vite dev server
 * forwards it to the gateway) and in Kubernetes (the gateway serves the pages and the API from the same address).
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 15_000,
  headers: { Accept: 'application/json' },
})

// Adds "Authorization: Bearer <jwt>" when a session exists. The token is never logged.
http.interceptors.request.use((config) => {
  const token = tokenStore.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

const isAuthEndpoint = (url?: string): boolean => !!url && (url.startsWith('/auth/login') || url.startsWith('/auth/register'))

http.interceptors.response.use(
  (response) => {
    const pod = response.headers['x-served-by']
    if (typeof pod === 'string') servedBy.set(pod)
    return response
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const pod = error.response?.headers?.['x-served-by']
      if (typeof pod === 'string') servedBy.set(pod)
      // 401 on a protected call = expired or invalid token. (A 401 from login just means "wrong password".)
      if (error.response?.status === 401 && !isAuthEndpoint(error.config?.url)) {
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
      }
    }
    return Promise.reject(toAppError(error))
  },
)

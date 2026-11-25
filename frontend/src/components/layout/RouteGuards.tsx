import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { Role } from '../../types/api'
import { homeFor } from './navigation'

/**
 * Keeps signed-out visitors out of the dashboard and sends them to the login page (remembering where they wanted to go).
 * This is only a convenience for the interface: the API gateway rejects every request without a valid token anyway.
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Only for pages of one role. Again just a convenience: the backend enforces the real permissions (403). */
export function RoleRoute({ role }: { role: Role }) {
  const { user } = useAuth()
  if (user?.role !== role) return <Navigate to={homeFor(user?.role)} replace />
  return <Outlet />
}

/** "/app" itself: send each role to its own home page. */
export function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homeFor(user?.role)} replace />
}

/** Login and registration pages are not for people who are already signed in. */
export function GuestRoute() {
  const { isAuthenticated, user } = useAuth()
  if (isAuthenticated) return <Navigate to={homeFor(user?.role)} replace />
  return <Outlet />
}

import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { LoadingState } from './components/common/States'
import { GuestRoute, HomeRedirect, ProtectedRoute, RoleRoute } from './components/layout/RouteGuards'
import { AppLayout } from './layouts/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Register from './pages/Register'

// The dashboard pages are loaded on demand, so the landing and login pages stay small and fast.
const Overview = lazy(() => import('./pages/Overview'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const ReportEmergency = lazy(() => import('./pages/ReportEmergency'))
const Incidents = lazy(() => import('./pages/Incidents'))
const Responders = lazy(() => import('./pages/Responders'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))

/**
 * Routes:
 *   /, /login, /register            public (login and register redirect signed-in users to their home page)
 *   /app/*                          needs a session; /app/admin additionally needs the ADMIN role
 * These guards are only a convenience for the interface; the API gateway and the services enforce the real security.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route path="/app" element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route
            path="*"
            element={
              <Suspense fallback={<LoadingState />}>
                <AppPages />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

/** The pages inside the signed-in layout. Paths are relative to /app/*. */
function AppPages() {
  return (
    <Routes>
      <Route path="overview" element={<Overview />} />
      <Route element={<RoleRoute role="ADMIN" />}>
        <Route path="admin" element={<AdminDashboard />} />
      </Route>
      <Route path="report" element={<ReportEmergency />} />
      <Route path="incidents" element={<Incidents />} />
      <Route path="responders" element={<Responders />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="settings" element={<Settings />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}

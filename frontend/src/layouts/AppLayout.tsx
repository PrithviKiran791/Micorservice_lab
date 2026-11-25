import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { NotificationsProvider } from '../contexts/NotificationsContext'
import { Sidebar } from '../components/layout/Sidebar'
import { Topbar } from '../components/layout/Topbar'
import { SkyLightRaysBackdrop } from '../components/ui/SkyLightRaysBackdrop'

/** The shell of every signed-in page: sidebar, top bar and the page content. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // close the mobile drawer after navigating
  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <NotificationsProvider>
      <div className="relative flex min-h-screen overflow-x-clip">
        <SkyLightRaysBackdrop />
        <Sidebar open={menuOpen} setOpen={setMenuOpen} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMenuOpen(true)} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationsProvider>
  )
}

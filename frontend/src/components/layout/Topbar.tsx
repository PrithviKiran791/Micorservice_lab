import { Menu, Server } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useServedBy } from '../../hooks/useServedBy'
import { Logo } from '../common/Logo'

/** Top strip: menu button on small screens, the signed-in user, and which pod answered the latest request. */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth()
  const pod = useServedBy()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-night/90 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3 lg:hidden">
        <button type="button" onClick={onMenu} className="rounded-md p-2 text-mute hover:bg-panel-2 hover:text-ink" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <Logo compact />
      </div>

      <div className="ml-auto flex items-center gap-4">
        {pod && (
          <span className="hidden items-center gap-1.5 text-xs text-faint md:inline-flex" title="Pod that answered the latest request (load balancing)">
            <Server className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-w-56 truncate">{pod}</span>
          </span>
        )}
        {user && (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-panel-2 text-sm font-semibold uppercase text-ink ring-1 ring-line" aria-hidden="true">
              {user.username.slice(0, 2)}
            </span>
            <div className="hidden leading-tight sm:block">
              <p className="max-w-40 truncate text-sm font-medium text-ink">{user.username}</p>
              <p className="text-xs text-faint">{user.role === 'ADMIN' ? 'Dispatcher (admin)' : 'Reporter'}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

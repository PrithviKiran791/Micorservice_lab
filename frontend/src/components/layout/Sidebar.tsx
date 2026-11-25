import { NavLink } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import { Logo } from '../common/Logo'
import { navFor } from './navigation'

interface SidebarProps {
  /** Mobile only: whether the slide-in drawer is open. */
  open: boolean
  onClose: () => void
}

/** Role-aware navigation. A fixed column on desktop, a slide-in drawer on small screens. */
export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const items = navFor(user?.role)

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-panel transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Logo />
          <button type="button" onClick={onClose} className="rounded p-1 text-mute hover:text-ink lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand/15 text-white ring-1 ring-brand/40' : 'text-mute hover:bg-panel-2 hover:text-ink'
                }`
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {badge === 'unread' && unreadCount > 0 && (
                <span className="rounded-full bg-critical px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${unreadCount} unread`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-mute transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>
    </>
  )
}

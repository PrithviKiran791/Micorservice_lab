import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import { Logo } from '../common/Logo'
import {
  Sidebar as AceternitySidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from '../ui/sidebar'
import { homeFor, navFor } from './navigation'

interface SidebarProps {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
}

function SidebarContent() {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const { open, setOpen } = useSidebar()
  const items = navFor(user?.role)

  return (
    <SidebarBody className="justify-between gap-6">
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div className="flex h-10 items-center px-1.5">
          <Link
            to={homeFor(user?.role)}
            aria-label="ResQNet Lite home"
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                setOpen(false)
              }
            }}
            className="flex items-center"
          >
            <Logo compact={!open} />
          </Link>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1.5" aria-label="Sidebar links">
          {items.map(({ to, label, icon: Icon, badge }) => {
            const hasUnread = badge === 'unread' && unreadCount > 0
            return (
              <SidebarLink
                key={to}
                link={{
                  label,
                  href: to,
                  icon: (
                    <span className="relative inline-flex items-center justify-center">
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      {hasUnread && !open && (
                        <span
                          className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-critical ring-2 ring-slate-950"
                          aria-label={`${unreadCount} unread`}
                        />
                      )}
                    </span>
                  ),
                  badge: hasUnread ? (
                    <span
                      className="rounded-full bg-critical px-2 py-0.5 text-xs font-semibold text-white"
                      aria-label={`${unreadCount} unread`}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : undefined,
                }}
              />
            )
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
        {user && (
          <div
            className="flex items-center gap-3 rounded-xl px-2 py-1.5"
            title={!open ? `${user.username} (${user.role === 'ADMIN' ? 'Dispatcher' : 'Reporter'})` : undefined}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xs font-semibold uppercase text-white"
              aria-hidden="true"
            >
              {user.username.slice(0, 2)}
            </span>
            <motion.div
              initial={false}
              animate={{
                display: open ? 'block' : 'none',
                opacity: open ? 1 : 0,
              }}
              transition={{ duration: 0.16 }}
              className="min-w-0 leading-tight"
            >
              <p className="max-w-36 truncate text-sm font-medium text-white">{user.username}</p>
              <p className="text-xs text-mute">
                {user.role === 'ADMIN' ? 'Dispatcher (admin)' : 'Reporter'}
              </p>
            </motion.div>
          </div>
        )}

        <button
          type="button"
          onClick={logout}
          title={!open ? 'Log out' : undefined}
          className="group/sidebar flex w-full items-center justify-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-mute transition-colors hover:border-white/10 hover:bg-white/8 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <motion.span
            initial={false}
            animate={{
              display: open ? 'inline-block' : 'none',
              opacity: open ? 1 : 0,
            }}
            transition={{ duration: 0.16 }}
            className="!m-0 whitespace-pre !p-0 transition duration-150 group-hover/sidebar:translate-x-0.5"
          >
            Log out
          </motion.span>
        </button>
      </div>
    </SidebarBody>
  )
}

/** Role-aware collapsible Aceternity sidebar with glassmorphism styling. */
export function Sidebar({ open, setOpen }: SidebarProps) {
  return (
    <AceternitySidebar open={open} setOpen={setOpen}>
      <SidebarContent />
    </AceternitySidebar>
  )
}

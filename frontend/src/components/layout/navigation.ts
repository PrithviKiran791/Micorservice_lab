import { BarChart3, Bell, ClipboardList, LayoutDashboard, Settings, ShieldCheck, Siren, Truck, type LucideIcon } from 'lucide-react'
import type { Role } from '../../types/api'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** If set, only this role sees the item (the backend still enforces the permission itself). */
  role?: Role
  /** Shows the unread-notification counter next to the label. */
  badge?: 'unread'
}

/** The sidebar. Administrator items are hidden from regular users; reporter-only items are hidden from administrators. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/app/overview', label: 'Overview', icon: LayoutDashboard, role: 'USER' },
  { to: '/app/admin', label: 'Admin dashboard', icon: ShieldCheck, role: 'ADMIN' },
  { to: '/app/report', label: 'Report emergency', icon: Siren },
  { to: '/app/incidents', label: 'Incidents', icon: ClipboardList },
  { to: '/app/responders', label: 'Responders', icon: Truck },
  { to: '/app/notifications', label: 'Notifications', icon: Bell, badge: 'unread' },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export function navFor(role: Role | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.role || item.role === role)
}

/** Where a user lands after signing in. */
export function homeFor(role: Role | undefined): string {
  return role === 'ADMIN' ? '/app/admin' : '/app/overview'
}

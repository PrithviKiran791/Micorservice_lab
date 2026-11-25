import { Activity, BarChart3, Bell, ClipboardCheck, ClipboardList, LayoutDashboard, Lock, Network, Settings, ShieldCheck, Siren, Truck, UserCircle, type LucideIcon } from 'lucide-react'
import type { Role } from '../../types/api'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Only these roles see the item (the backend still enforces the permission itself). */
  roles: Role[]
  /** Different wording for a role, for example "My incidents" for a reporter. */
  labelFor?: Partial<Record<Role, string>>
  /** Shows the unread-notification counter next to the label. */
  badge?: 'unread'
}

/**
 * The sidebar. The reporter portal stays small; the administrator gets the operations command center.
 * Hiding an item is only a convenience: the API gateway and the services enforce the real permissions.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/app/overview', label: 'Overview', icon: LayoutDashboard, roles: ['USER'] },
  { to: '/app/admin', label: 'Operations overview', icon: ShieldCheck, roles: ['ADMIN'] },
  { to: '/app/report', label: 'Report emergency', icon: Siren, roles: ['USER'] },
  { to: '/app/incidents', label: 'Incidents', icon: ClipboardList, roles: ['USER', 'ADMIN'], labelFor: { USER: 'My incidents' } },
  { to: '/app/responders', label: 'Responders', icon: Truck, roles: ['ADMIN'] },
  { to: '/app/notifications', label: 'Notifications', icon: Bell, roles: ['USER', 'ADMIN'], badge: 'unread' },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3, roles: ['ADMIN'] },
  { to: '/app/health', label: 'Service health', icon: Activity, roles: ['ADMIN'] },
  { to: '/app/architecture', label: 'Architecture', icon: Network, roles: ['ADMIN'] },
  { to: '/app/lab', label: 'Lab evaluation', icon: ClipboardCheck, roles: ['ADMIN'] },
  { to: '/app/security', label: 'Security', icon: Lock, roles: ['ADMIN'] },
  { to: '/app/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
  { to: '/app/settings', label: 'Profile', icon: UserCircle, roles: ['USER'] },
]

export function navFor(role: Role | undefined): NavItem[] {
  if (!role) return []
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({ ...item, label: item.labelFor?.[role] ?? item.label }))
}

/** Where a user lands after signing in. */
export function homeFor(role: Role | undefined): string {
  return role === 'ADMIN' ? '/app/admin' : '/app/overview'
}

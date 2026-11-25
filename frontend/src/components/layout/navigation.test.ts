import { describe, expect, it } from 'vitest'
import { homeFor, navFor } from './navigation'

describe('navigation per role (the reporter portal stays small, the administrator gets the command center)', () => {
  it('USER sees exactly: Overview, Report emergency, My incidents, Notifications, Profile', () => {
    expect(navFor('USER').map((i) => i.label)).toEqual(['Overview', 'Report emergency', 'My incidents', 'Notifications', 'Profile'])
  })

  it('ADMIN sees the operations pages and none of the reporter-only pages', () => {
    expect(navFor('ADMIN').map((i) => i.label)).toEqual([
      'Operations overview', 'Incidents', 'Responders', 'Notifications', 'Analytics', 'Service health', 'Architecture', 'Lab evaluation', 'Security', 'Settings',
    ])
  })

  it('shows no infrastructure page to a regular user', () => {
    const paths = navFor('USER').map((i) => i.to)
    for (const p of ['/app/health', '/app/architecture', '/app/lab', '/app/security', '/app/admin']) expect(paths).not.toContain(p)
  })

  it('shows nothing when signed out and sends each role to its own home page', () => {
    expect(navFor(undefined)).toEqual([])
    expect(homeFor('ADMIN')).toBe('/app/admin')
    expect(homeFor('USER')).toBe('/app/overview')
  })
})

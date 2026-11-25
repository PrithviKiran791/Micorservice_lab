import { describe, expect, it } from 'vitest'
import { incident, responder } from '../test/fixtures'
import { activityOverTime, countBySeverity, countByStatus, countByType, responderAvailability, summarize } from './stats'

describe('summarize', () => {
  it('counts every status and open critical incidents', () => {
    const list = [
      incident({ id: 1, status: 'PENDING', severity: 'CRITICAL' }),
      incident({ id: 2, status: 'ASSIGNED', severity: 'CRITICAL' }),
      incident({ id: 3, status: 'RESOLVED', severity: 'CRITICAL' }), // resolved critical is NOT open
      incident({ id: 4, status: 'REPORTED' }),
      incident({ id: 5, status: 'ASSIGNED' }),
    ]
    expect(summarize(list)).toEqual({ total: 5, reported: 1, pending: 1, assigned: 2, resolved: 1, openCritical: 2 })
  })

  it('handles an empty list', () => {
    expect(summarize([])).toEqual({ total: 0, reported: 0, pending: 0, assigned: 0, resolved: 0, openCritical: 0 })
  })
})

describe('counting helpers', () => {
  const list = [incident({ type: 'FIRE', severity: 'LOW', status: 'RESOLVED' }), incident({ type: 'FIRE', severity: 'CRITICAL' }), incident({ type: 'POLICE', severity: 'CRITICAL' })]

  it('counts by type, severity and status, including zeros', () => {
    expect(countByType(list)).toEqual({ MEDICAL: 0, FIRE: 2, POLICE: 1 })
    expect(countBySeverity(list)).toEqual({ LOW: 1, MEDIUM: 0, CRITICAL: 2 })
    expect(countByStatus(list)).toEqual({ REPORTED: 0, PENDING: 2, ASSIGNED: 0, RESOLVED: 1 })
  })
})

describe('responderAvailability', () => {
  it('counts by status and by type', () => {
    const list = [
      responder({ id: 1, type: 'AMBULANCE', status: 'AVAILABLE' }),
      responder({ id: 2, type: 'AMBULANCE', status: 'BUSY', currentIncidentId: 9 }),
      responder({ id: 3, type: 'POLICE', status: 'OFFLINE' }),
    ]
    const a = responderAvailability(list)
    expect(a.total).toBe(3)
    expect(a.byStatus).toEqual({ AVAILABLE: 1, BUSY: 1, OFFLINE: 1 })
    expect(a.byType.AMBULANCE).toEqual({ AVAILABLE: 1, BUSY: 1, OFFLINE: 0 })
    expect(a.byType.FIRE_TRUCK).toEqual({ AVAILABLE: 0, BUSY: 0, OFFLINE: 0 })
  })
})

describe('activityOverTime', () => {
  const at = (iso: string) => incident({ createdAt: iso })

  it('returns no points when there are no incidents', () => {
    expect(activityOverTime([]).points).toEqual([])
  })

  it('uses 10-minute buckets inside 3 hours and keeps empty buckets between', () => {
    const { granularity, points } = activityOverTime([at('2026-11-25T10:01:00Z'), at('2026-11-25T10:04:00Z'), at('2026-11-25T10:31:00Z')])
    expect(granularity).toBe('ten minutes')
    expect(points.reduce((n, p) => n + p.count, 0)).toBe(3)
    expect(points.length).toBeGreaterThanOrEqual(4) // 10:00, 10:10, 10:20, 10:30 (in local time zone terms)
    expect(points.some((p) => p.count === 0)).toBe(true)
    expect(Math.max(...points.map((p) => p.count))).toBe(2) // the two incidents within the same 10 minutes
  })

  it('uses hours up to 48 hours and days beyond', () => {
    expect(activityOverTime([at('2026-11-25T10:00:00Z'), at('2026-11-26T10:00:00Z')]).granularity).toBe('hour')
    expect(activityOverTime([at('2026-11-20T10:00:00Z'), at('2026-11-25T10:00:00Z')]).granularity).toBe('day')
  })

  it('never loses an incident whatever the granularity', () => {
    const list = [at('2026-11-20T10:00:00Z'), at('2026-11-21T23:59:00Z'), at('2026-11-25T10:00:00Z')]
    expect(activityOverTime(list).points.reduce((n, p) => n + p.count, 0)).toBe(3)
  })
})

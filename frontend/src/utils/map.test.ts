import { describe, expect, it } from 'vitest'
import { incident } from '../test/fixtures'
import { formatCoordinates, incidentCoordinates, roundCoordinate, splitByCoordinates, toCoordinates, wrapLongitude } from './geo'
import { applyMapFilters, DEFAULT_MAP_FILTERS, filtersActive } from './mapFilters'
import { MARKER_COLORS, markerColor } from './mapStyle'
import { toCreateRequest, validateIncident } from './validation'

describe('toCoordinates (a position needs two numbers in range)', () => {
  it('accepts valid pairs, including the limits', () => {
    expect(toCoordinates(12.9716, 77.5946)).toEqual({ lat: 12.9716, lng: 77.5946 })
    expect(toCoordinates(-90, 180)).toEqual({ lat: -90, lng: 180 })
    expect(toCoordinates(0, 0)).toEqual({ lat: 0, lng: 0 })
  })
  it('rejects missing, non-numeric, non-finite and out-of-range values', () => {
    expect(toCoordinates(null, 77)).toBeNull()
    expect(toCoordinates(12, undefined)).toBeNull()
    expect(toCoordinates('12.9', '77.5')).toBeNull()
    expect(toCoordinates(NaN, 10)).toBeNull()
    expect(toCoordinates(Infinity, 10)).toBeNull()
    expect(toCoordinates(90.0001, 10)).toBeNull()
    expect(toCoordinates(10, -180.5)).toBeNull()
  })
})

describe('splitByCoordinates (incidents without a position are not lost)', () => {
  it('puts located and unlocated incidents in separate lists and keeps every incident', () => {
    const list = [
      incident({ id: 1, latitude: 12.97, longitude: 77.59 }),
      incident({ id: 2, latitude: null, longitude: null }),
      incident({ id: 3, latitude: 12.97, longitude: null }), // only one of the pair: cannot be drawn
      incident({ id: 4, latitude: 200, longitude: 10 }), // invalid
    ]
    const { located, unlocated } = splitByCoordinates(list)
    expect(located.map((l) => l.incident.id)).toEqual([1])
    expect(unlocated.map((i) => i.id)).toEqual([2, 3, 4])
    expect(located.length + unlocated.length).toBe(list.length)
  })
  it('reads the position of one incident', () => {
    expect(incidentCoordinates(incident({ latitude: 1, longitude: 2 }))).toEqual({ lat: 1, lng: 2 })
    expect(incidentCoordinates(incident())).toBeNull()
  })
})

describe('coordinate helpers', () => {
  it('rounds to the 6 decimals the database stores', () => {
    expect(roundCoordinate(12.97161234567)).toBe(12.971612)
    expect(roundCoordinate(77.5946)).toBe(77.5946)
  })
  it('wraps longitudes that Leaflet reports after the world was panned around', () => {
    expect(wrapLongitude(190)).toBe(-170)
    expect(wrapLongitude(-190)).toBe(170)
    expect(wrapLongitude(77.5)).toBe(77.5)
    expect(wrapLongitude(180)).toBe(-180)
  })
  it('formats with 6 decimals', () => {
    expect(formatCoordinates({ lat: 12.9716, lng: 77.5946 })).toBe('12.971600, 77.594600')
  })
})

describe('marker colours', () => {
  it('follow severity and turn grey when resolved', () => {
    expect(markerColor('CRITICAL', 'PENDING')).toBe(MARKER_COLORS.CRITICAL)
    expect(markerColor('MEDIUM', 'ASSIGNED')).toBe(MARKER_COLORS.MEDIUM)
    expect(markerColor('LOW', 'REPORTED')).toBe(MARKER_COLORS.LOW)
    expect(markerColor('CRITICAL', 'RESOLVED')).toBe(MARKER_COLORS.RESOLVED)
    expect(MARKER_COLORS.CRITICAL).toBe('#ef4444') // red
    expect(MARKER_COLORS.MEDIUM).toBe('#f59e0b') // amber
  })
})

describe('applyMapFilters', () => {
  const now = new Date('2026-11-25T12:00:00Z').getTime()
  const list = [
    incident({ id: 1, type: 'FIRE', severity: 'CRITICAL', status: 'PENDING', createdAt: '2026-11-25T11:30:00Z' }),
    incident({ id: 2, type: 'MEDICAL', severity: 'LOW', status: 'ASSIGNED', createdAt: '2026-11-25T06:00:00Z' }),
    incident({ id: 3, type: 'POLICE', severity: 'MEDIUM', status: 'RESOLVED', createdAt: '2026-11-20T06:00:00Z' }),
  ]
  const ids = (f: Partial<typeof DEFAULT_MAP_FILTERS>) => applyMapFilters(list, { ...DEFAULT_MAP_FILTERS, ...f }, now).map((i) => i.id)

  it('shows everything with the default filters', () => {
    expect(ids({})).toEqual([1, 2, 3])
    expect(filtersActive(DEFAULT_MAP_FILTERS)).toBe(false)
  })
  it('filters by type, severity and status', () => {
    expect(ids({ type: 'FIRE' })).toEqual([1])
    expect(ids({ severity: 'LOW' })).toEqual([2])
    expect(ids({ status: 'RESOLVED' })).toEqual([3])
    expect(ids({ type: 'FIRE', status: 'RESOLVED' })).toEqual([])
  })
  it('filters by when the incident was reported', () => {
    expect(ids({ since: '1h' })).toEqual([1])
    expect(ids({ since: '24h' })).toEqual([1, 2])
    expect(ids({ since: '7d' })).toEqual([1, 2, 3])
  })
  it('knows when a filter is active', () => {
    expect(filtersActive({ ...DEFAULT_MAP_FILTERS, severity: 'CRITICAL' })).toBe(true)
  })
})

describe('report form: coordinates are optional', () => {
  const base = { type: 'MEDICAL', severity: 'CRITICAL', description: 'Person collapsed', locationText: 'Main Road' } as const

  it('a report without a position is valid and sends no coordinates', () => {
    expect(validateIncident({ ...base })).toEqual({})
    const body = toCreateRequest({ ...base, position: null })
    expect(body).toEqual({ type: 'MEDICAL', severity: 'CRITICAL', description: 'Person collapsed', locationText: 'Main Road' })
    expect('latitude' in body).toBe(false)
  })

  it('sends latitude and longitude together, rounded to 6 decimals', () => {
    const body = toCreateRequest({ ...base, position: { lat: 12.97161234, lng: 77.59464321 } })
    expect(body.latitude).toBe(12.971612)
    expect(body.longitude).toBe(77.594643)
  })

  it('never sends an invalid position', () => {
    const body = toCreateRequest({ ...base, position: { lat: 123, lng: 10 } })
    expect('latitude' in body).toBe(false)
    expect('longitude' in body).toBe(false)
  })
})

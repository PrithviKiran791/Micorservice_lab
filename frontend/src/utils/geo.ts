import type { Incident } from '../types/api'

export interface Coordinates {
  lat: number
  lng: number
}

/**
 * A coordinate pair is usable only if both numbers exist and are in range. The API treats latitude and longitude as
 * independent optional fields, so one can be present without the other; such an incident has no position on the map.
 */
export function toCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export function incidentCoordinates(incident: Pick<Incident, 'latitude' | 'longitude'>): Coordinates | null {
  return toCoordinates(incident.latitude, incident.longitude)
}

export interface Located {
  incident: Incident
  position: Coordinates
}

/** Splits incidents into those that can be drawn on the map and those that cannot (so none is lost from the interface). */
export function splitByCoordinates(incidents: Incident[]): { located: Located[]; unlocated: Incident[] } {
  const located: Located[] = []
  const unlocated: Incident[] = []
  for (const incident of incidents) {
    const position = incidentCoordinates(incident)
    if (position) located.push({ incident, position })
    else unlocated.push(incident)
  }
  return { located, unlocated }
}

/** The database stores 6 decimals (NUMERIC(9,6), about 0.1 m), so more digits are rounded away before sending. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

export function roundCoordinates(c: Coordinates): Coordinates {
  return { lat: roundCoordinate(c.lat), lng: roundCoordinate(c.lng) }
}

/** Leaflet can report longitudes beyond +-180 after the world is panned around; bring them back into range. */
export function wrapLongitude(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

export function formatCoordinates(c: Coordinates): string {
  return `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`
}

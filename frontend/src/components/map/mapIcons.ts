import { divIcon, type DivIcon } from 'leaflet'
import type { IncidentStatus, IncidentType, Severity } from '../../types/api'
import { markerColor } from '../../utils/mapStyle'

/**
 * Marker icons. Each is a small inline SVG pin, so no image files are needed:
 *   colour       = severity (grey once resolved)
 *   glyph inside = type (cross = medical, flame = fire, shield = police)
 *   badge        = status (green tick = assigned, "!" = waiting for a responder)
 * Icons are cached: one object per combination, so re-rendering many markers does not create new icons.
 */
const GLYPH: Record<IncidentType, string> = {
  MEDICAL: '<path d="M14.2 8h3.6v5.2H23v3.6h-5.2V22h-3.6v-5.2H9v-3.6h5.2z" fill="#fff"/>',
  FIRE: '<path d="M16 7c.9 3 4.8 4.9 4.8 9a4.8 4.8 0 0 1-9.6 0c0-1.9.9-3 1.9-3.9.1 1.8.9 2.8 1.9 2.8-.4-2.9-.5-5 1-7.9z" fill="#fff"/>',
  POLICE: '<path d="M16 7.2l6 2.1v5c0 3.7-2.6 6.4-6 7.6-3.4-1.2-6-3.9-6-7.6v-5z" fill="#fff"/>',
}

const BADGE: Record<IncidentStatus, string> = {
  ASSIGNED: '<circle cx="26.5" cy="7.5" r="5.5" fill="#22c55e" stroke="#0a1020" stroke-width="1.5"/><path d="M23.9 7.6l1.9 1.9 3.4-3.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  PENDING: '<circle cx="26.5" cy="7.5" r="5.5" fill="#fff" stroke="#0a1020" stroke-width="1.5"/><path d="M26.5 4.6v3.6M26.5 10.3v.1" stroke="#0a1020" stroke-width="1.8" stroke-linecap="round"/>',
  REPORTED: '<circle cx="26.5" cy="7.5" r="5.5" fill="#fff" stroke="#0a1020" stroke-width="1.5"/><path d="M26.5 4.6v3.6M26.5 10.3v.1" stroke="#0a1020" stroke-width="1.8" stroke-linecap="round"/>',
  RESOLVED: '',
}

const cache = new Map<string, DivIcon>()

export function incidentIcon(type: IncidentType, severity: Severity, status: IncidentStatus, selected = false): DivIcon {
  const key = `${type}|${severity}|${status}|${selected}`
  const hit = cache.get(key)
  if (hit) return hit
  const color = markerColor(severity, status)
  const html = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42" aria-hidden="true">
    <path d="M16 1C8 1 2 7.3 2 15.2 2 25.6 16 41 16 41s14-15.4 14-25.8C30 7.3 24 1 16 1z" fill="${color}" stroke="#0a1020" stroke-width="2"/>
    ${GLYPH[type]}${BADGE[status]}
  </svg>`
  const icon = divIcon({
    html,
    className: `rq-pin${selected ? ' rq-pin-selected' : ''}`,
    iconSize: [32, 42],
    iconAnchor: [16, 41],      // the tip of the pin is the exact position
    popupAnchor: [0, -38],
  })
  cache.set(key, icon)
  return icon
}

/** The marker used by the location picker (the position the reporter is choosing). */
export const pickerIcon: DivIcon = divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42" aria-hidden="true">
    <path d="M16 1C8 1 2 7.3 2 15.2 2 25.6 16 41 16 41s14-15.4 14-25.8C30 7.3 24 1 16 1z" fill="#3b82f6" stroke="#fff" stroke-width="2"/>
    <circle cx="16" cy="15" r="5" fill="#fff"/>
  </svg>`,
  className: 'rq-pin rq-pin-picker',
  iconSize: [32, 42],
  iconAnchor: [16, 41],
})

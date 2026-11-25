import { GEOCODER_URL } from '../components/map/mapConfig'
import { toCoordinates, type Coordinates } from '../utils/geo'

export interface Place {
  name: string
  position: Coordinates
}

/**
 * Place search for the location picker, using OpenStreetMap Nominatim by default.
 *
 * This is NOT the backend and deliberately does not use the application's Axios client: that client adds the user's
 * JWT, which must never be sent to a third-party service. It is a plain fetch with no credentials.
 *
 * Nominatim usage policy: one request per second at most, no search-as-you-type, an identifying Referer (the browser
 * sends it). The caller therefore searches only when the user presses Search and waits between searches.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const url = `${GEOCODER_URL}?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' }, credentials: 'omit' })
  if (!response.ok) throw new Error(`The place search answered HTTP ${response.status}.`)
  const body: unknown = await response.json()
  if (!Array.isArray(body)) return []
  const places: Place[] = []
  for (const item of body as { display_name?: unknown; lat?: unknown; lon?: unknown }[]) {
    const position = toCoordinates(Number(item.lat), Number(item.lon))
    if (position && typeof item.display_name === 'string') places.push({ name: item.display_name, position })
  }
  return places
}

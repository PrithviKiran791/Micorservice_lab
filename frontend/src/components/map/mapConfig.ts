/**
 * Map configuration. Everything that could change when another tile provider or geocoder is used is read from the
 * environment, with OpenStreetMap as the default (see frontend/.env.example).
 *
 * OpenStreetMap public tile policy (https://operations.osmfoundation.org/policies/tiles/): keep the attribution visible,
 * do not bulk-download or pre-cache tiles, and do not treat the public service as a guaranteed production service.
 * The tiles here are only the ones the browser needs for the part of the map that is on screen.
 */
export const TILE_URL: string = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const TILE_ATTRIBUTION: string =
  import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'

export const MAX_ZOOM = 19

/**
 * Where the map looks before there is anything to show. It is NOT the user's location and is never presented as such.
 * (Bengaluru, as in the API contract examples.) Once incidents with coordinates exist, the map fits them instead.
 */
export const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]
export const DEFAULT_ZOOM = 11

/** Place search used by the location picker (OpenStreetMap Nominatim by default). Called only when the user presses Search. */
export const GEOCODER_URL: string = import.meta.env.VITE_GEOCODER_URL || 'https://nominatim.openstreetmap.org/search'

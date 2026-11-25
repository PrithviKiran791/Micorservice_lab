import './leafletSetup'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { searchPlaces, type Place } from '../../services/geocoder'
import { formatCoordinates, roundCoordinates, wrapLongitude, type Coordinates } from '../../utils/geo'
import { Button } from '../common/Button'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from './mapConfig'
import { pickerIcon } from './mapIcons'

interface Props {
  value: Coordinates | null
  onChange: (value: Coordinates | null) => void
  /** Called with the name of a place the reporter chose from the search results, to suggest a location description. */
  onPlaceName?: (name: string) => void
}

interface Focus {
  position: Coordinates
  zoom: number
  nonce: number
}

function ClickToPlace({ onPick }: { onPick: (c: Coordinates) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: wrapLongitude(e.latlng.lng) }) })
  return null
}

function FlyTo({ focus }: { focus: Focus | null }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.position.lat, focus.position.lng], focus.zoom, { duration: 0.6 })
  }, [map, focus])
  return null
}

function KeepSized() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

/**
 * Lets the reporter choose where the emergency is: click the map, drag the pin to refine it, search for a place or use
 * the device location (only when the button is pressed). The position is optional: without one the report is sent
 * exactly as before, with only the text description.
 */
export function LocationPicker({ value, onChange, onPlaceName }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [focus, setFocus] = useState<Focus | null>(null)
  const lastSearch = useRef(0)
  const nonce = useRef(0)

  const initialCenter = useMemo<[number, number]>(() => (value ? [value.lat, value.lng] : DEFAULT_CENTER), []) // eslint-disable-line react-hooks/exhaustive-deps -- only the first value positions the map

  const place = useCallback((c: Coordinates) => onChange(roundCoordinates(c)), [onChange])
  const flyTo = useCallback((position: Coordinates, zoom = 16) => setFocus({ position, zoom, nonce: ++nonce.current }), [])

  async function runSearch() {
    const q = query.trim()
    setMessage(null)
    if (q.length < 3) { setMessage('Type at least 3 characters to search.'); return }
    const wait = 1000 - (Date.now() - lastSearch.current)
    if (wait > 0) { setMessage('Please wait a second between searches (OpenStreetMap usage policy).'); return }
    lastSearch.current = Date.now()
    setSearching(true)
    try {
      const found = await searchPlaces(q)
      setResults(found)
      if (found.length === 0) setMessage('No place found. Try another name, or click the map instead.')
    } catch (e) {
      setResults(null)
      setMessage(e instanceof Error ? `${e.message} You can still click the map to choose a position.` : 'The place search failed. You can still click the map.')
    } finally {
      setSearching(false)
    }
  }

  function choose(p: Place) {
    place(p.position)
    flyTo(p.position)
    onPlaceName?.(p.name)
    setResults(null)
    setMessage(null)
  }

  function useMyLocation() {
    setMessage(null)
    if (!('geolocation' in navigator)) { setMessage('This browser cannot provide a location. Click the map instead.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        place(c)
        flyTo(c)
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        setMessage(err.code === err.PERMISSION_DENIED ? 'Location access was not allowed. You can click the map instead.' : 'Your location could not be determined. Click the map instead.')
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <label htmlFor="place-search" className="sr-only">Search for a place</label>
          <input
            id="place-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runSearch() } }}
            placeholder="Search a place, for example MG Road Bengaluru"
            className="h-10 w-full rounded-md border border-line bg-night pl-9 pr-3 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            autoComplete="off"
          />
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-faint" aria-hidden="true" />
        </div>
        <Button variant="secondary" onClick={() => void runSearch()} loading={searching}>Search</Button>
        <Button variant="secondary" icon={locating ? undefined : Crosshair} onClick={useMyLocation} loading={locating}>Use my location</Button>
      </div>

      {results && results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-panel-2 text-sm" aria-label="Search results">
          {results.map((r, i) => (
            <li key={`${r.position.lat},${r.position.lng},${i}`}>
              <button type="button" onClick={() => choose(r)} className="flex w-full items-start gap-2 px-3 py-2 text-left text-ink hover:bg-panel">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 break-words">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="text-xs text-amber" role="status">{message}</p>}

      <div className="relative h-72 overflow-hidden rounded-lg border border-line sm:h-80">
        <MapContainer center={initialCenter} zoom={value ? 15 : DEFAULT_ZOOM} maxZoom={MAX_ZOOM} scrollWheelZoom className="h-full w-full" aria-label="Map for choosing the emergency location. Click to place the pin.">
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={MAX_ZOOM} />
          <ClickToPlace onPick={place} />
          <FlyTo focus={focus} />
          <KeepSized />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pickerIcon}
              draggable
              title="Selected location: drag to adjust"
              eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); place({ lat: p.lat, lng: wrapLongitude(p.lng) }) } }}
            />
          )}
        </MapContainer>
        {searching && (
          <div className="pointer-events-none absolute right-3 top-3 z-[1000] rounded-md border border-line bg-panel px-2 py-1 text-xs text-mute"><Loader2 className="inline h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Searching...</div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-live="polite">
        {value ? (
          <>
            <p className="text-ink"><span className="text-mute">Selected position:</span> {formatCoordinates(value)}</p>
            <Button size="sm" variant="ghost" icon={X} onClick={() => onChange(null)}>Clear position</Button>
          </>
        ) : (
          <p className="text-mute">No position selected. Click the map to place the pin; the report can also be sent without one.</p>
        )}
      </div>
      <p className="text-xs text-faint">Click the map to place the pin, then drag the pin to refine it. The map initially shows a default area, not your location.</p>
    </div>
  )
}

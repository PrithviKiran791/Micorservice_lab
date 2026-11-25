import './leafletSetup'
import { useEffect, useMemo, useRef } from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import type { AppError } from '../../services/errors'
import type { Incident } from '../../types/api'
import { splitByCoordinates, type Coordinates } from '../../utils/geo'
import { IncidentMarker } from './IncidentMarker'
import { MapControls } from './MapControls'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAX_ZOOM, TILE_ATTRIBUTION, TILE_URL } from './mapConfig'
import { fitToPoints } from './mapView'

export interface MapFocus {
  position: Coordinates
  /** Change this number to focus the same position again. */
  nonce: number
}

interface Props {
  /** Incidents to show. Those without valid coordinates are not drawn (the caller lists them separately). */
  incidents: Incident[]
  selectedId?: number | null
  onSelect?: (id: number) => void
  /** Pan to a position when this changes (used when an incident is picked from a list next to the map). */
  focus?: MapFocus | null
  loading?: boolean
  error?: AppError | null
  onRetry?: () => void
  /** Tailwind height classes; the map needs an explicit height. */
  className?: string
}

/** Fits the view to the incidents once, when the first ones arrive. Later refreshes never move the map. */
function FitOnFirstData({ points }: { points: Coordinates[] }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || points.length === 0) return
    done.current = true
    fitToPoints(map, points)
  }, [map, points])
  return null
}

function FocusOn({ focus }: { focus?: MapFocus | null }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.position.lat, focus.position.lng], Math.max(map.getZoom(), 14), { duration: 0.6 })
  }, [map, focus])
  return null
}

/** Leaflet measures its container once; tell it when the container changes size (window resize, side panels, rotation). */
function KeepSized() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(el)
    return () => observer.disconnect()
  }, [map])
  return null
}

/**
 * The incident map: OpenStreetMap tiles with one marker per incident that has stored coordinates. The map object is
 * created once by React Leaflet; data refreshes only add, update or remove markers, they never reset the view.
 */
export function EmergencyMap({ incidents, selectedId = null, onSelect, focus = null, loading = false, error = null, onRetry, className = 'h-[420px] sm:h-[520px]' }: Props) {
  const { located } = useMemo(() => splitByCoordinates(incidents), [incidents])
  const points = useMemo(() => located.map((l) => l.position), [located])

  return (
    <div className={`relative overflow-hidden rounded-lg border border-line ${className}`}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} maxZoom={MAX_ZOOM} scrollWheelZoom className="h-full w-full" aria-label="Map of reported incidents">
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={MAX_ZOOM} />
        <FitOnFirstData points={points} />
        <FocusOn focus={focus} />
        <KeepSized />
        <MapControls points={points} />
        {located.map(({ incident, position }) => (
          <IncidentMarker key={incident.id} incident={incident} position={position} selected={incident.id === selectedId} onSelect={onSelect} />
        ))}
      </MapContainer>

      {loading && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-night/60" role="status">
          <span className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-mute">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading incidents...
          </span>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-x-3 bottom-8 z-[1000] flex flex-wrap items-center gap-3 rounded-md border border-amber/40 bg-panel/95 px-3 py-2 text-sm text-amber" role="alert">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">Incidents could not be refreshed: {error.message} The markers shown may be out of date.</span>
          {onRetry && <button type="button" onClick={onRetry} className="rounded border border-amber/50 px-2 py-0.5 text-xs font-medium hover:bg-amber/10">Try again</button>}
        </div>
      )}
      {!loading && located.length === 0 && !error && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-md border border-line bg-panel/95 px-3 py-1.5 text-xs text-mute">
          No incident with a map position to show. The map is centred on a default view, not on a location.
        </div>
      )}
    </div>
  )
}

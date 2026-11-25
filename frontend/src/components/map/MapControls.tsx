import { useEffect, useRef } from 'react'
import { DomEvent } from 'leaflet'
import { Home, Maximize2 } from 'lucide-react'
import { useMap } from 'react-leaflet'
import type { Coordinates } from '../../utils/geo'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from './mapConfig'
import { fitToPoints } from './mapView'

/** Extra buttons on the map (zoom buttons come from Leaflet). They sit inside the map, so clicks must not reach it. */
export function MapControls({ points }: { points: Coordinates[] }) {
  const map = useMap()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) DomEvent.disableClickPropagation(ref.current)
  }, [])

  const button = 'flex h-9 w-9 items-center justify-center rounded-md border border-line bg-panel text-ink shadow-md transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:text-faint'
  return (
    <div ref={ref} className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
      <button type="button" className={button} onClick={() => fitToPoints(map, points)} disabled={points.length === 0} aria-label="Fit the map to all incidents shown" title="Fit to incidents">
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" className={button} onClick={() => map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)} aria-label="Return to the default map view" title="Default view (not your location)">
        <Home className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

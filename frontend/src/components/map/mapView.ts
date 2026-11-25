import { latLngBounds, type Map as LeafletMap } from 'leaflet'
import type { Coordinates } from '../../utils/geo'

/** Moves the map so that all points are visible (one point: a close-up; several: their bounding box). */
export function fitToPoints(map: LeafletMap, points: Coordinates[]): void {
  if (points.length === 0) return
  // Leaflet fits to the size it measured last; the container may have been laid out after that, so measure again first.
  map.invalidateSize({ animate: false })
  if (points.length === 1) {
    map.setView([points[0].lat, points[0].lng], 14)
    return
  }
  map.fitBounds(latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [48, 48], maxZoom: 15 })
}

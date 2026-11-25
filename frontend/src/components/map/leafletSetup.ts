// Imported once by every map component. Loads Leaflet's stylesheet and repairs the default marker icon.
//
// The known problem: Leaflet works out the URLs of its default marker images at run time, which breaks when a bundler
// renames the files. The map in this app draws its own markers (divIcon with inline SVG), so it does not depend on
// those images, but anything that falls back to the default icon must still work, so the URLs are set explicitly.
import { Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete (Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

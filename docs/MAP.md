# Interactive incident map

The map shows incidents at the positions their reporters chose, on OpenStreetMap, inside the existing web UI. It is an **automatically refreshed incident map**. It is not live GPS tracking and does not show responders.

## What was already there (audit)

| Question | Answer, from the code |
|---|---|
| Does the API accept coordinates? | Yes. `POST /api/incidents` takes optional `latitude` (-90..90) and `longitude` (-180..180) as numbers (`CreateIncidentRequest`: `BigDecimal` with `@DecimalMin/@DecimalMax`). |
| Are they stored? | Yes. Table `incidents`: `latitude NUMERIC(9,6)`, `longitude NUMERIC(9,6)`, both nullable (`docs/schema.md`, entity `Incident`). Six decimals are about 0.1 m. |
| Are they returned? | Yes. `GET /api/incidents` and `GET /api/incidents/{id}` return `latitude` and `longitude`, `null` when the report had none (`IncidentResponse`). |
| Do responders have coordinates? | No. The responder service stores name, type, status, zone and the current incident only. |
| Backend change needed? | **None.** Two backend tests were added so the existing behaviour is covered (see Tests). |

Before this work the web UI never collected coordinates (the type had the fields, the form did not send them).

## Where things are

```text
frontend/src/components/map/
  mapConfig.ts        tile URL, attribution, default view, geocoder URL (all from environment, OpenStreetMap by default)
  leafletSetup.ts     loads Leaflet's CSS once and repairs the default marker icon URLs
  mapIcons.ts         marker icons: inline-SVG divIcons, cached (colour = severity, glyph = type, badge = status)
  mapView.ts          fit-to-points helper (measures the container first)
  EmergencyMap.tsx    the incident map (MapContainer, TileLayer, markers, controls, loading and error overlays)
  IncidentMarker.tsx  one marker (memoised) with its popup
  IncidentPopup.tsx   popup: id, type, severity, status, location, responder, reported time, View details
  MapControls.tsx     "fit to incidents" and "default view" buttons
  MapLegend.tsx       colours, symbols and badges
  MapFilters.tsx      type, severity, status, reported-within filters and Reset
  OperationsMap.tsx   the administrator section: map + filters + critical queue + recent incidents + incidents without position
  ResponderPanel.tsx  responders (availability and assignments only)
  LocationPicker.tsx  the picker used by the report form
frontend/src/utils/   geo.ts (coordinate rules), mapFilters.ts, mapStyle.ts      (pure functions, unit tested)
frontend/src/services/geocoder.ts   place search (not the backend client)
```

Libraries: `leaflet` 1.9, `react-leaflet` 5 (React 19), `@types/leaflet`. No clustering, routing or other geospatial library was added: an operations map of this size shows tens of incidents and the filters narrow them, so clustering would be an extra dependency without a benefit. If a deployment reached hundreds of simultaneous incidents, `leaflet.markercluster` would be the first addition.

React Leaflet owns the Leaflet map object (`MapContainer`); no map is created outside the component lifecycle. Data refreshes only add, update or remove markers. The view is fitted to the incidents **once**, when the first positions arrive, and afterwards only when the user presses "Fit to incidents" or picks an incident in a list, so polling never moves the map the user is looking at.

## Markers and popups

* **Colour = severity:** CRITICAL red `#ef4444`, MEDIUM amber `#f59e0b`, LOW blue `#38bdf8`. A RESOLVED incident is grey `#6b7280` whatever its severity.
* **Symbol = type:** cross medical, flame fire, shield police.
* **Badge = status:** green tick assigned, white "!" waiting for a responder (PENDING or REPORTED), none when resolved.
* **Popup:** incident id, type, severity, status, location description, assigned responder (or "not assigned yet"), reported time and coordinates, and **View details**, which opens `/app/incidents?open=<id>`. That dialog loads the incident with `GET /api/incidents/{id}`.
* Markers are keyboard focusable and carry a text title. Icons are cached, markers are memoised.

Incidents without a **valid pair** of coordinates (none, only one of the two, or out of range) are never drawn. They are listed in the side panel "Without a map position" and still open their details, so no incident is lost from the interface.

## Administrator dashboard (Operations overview)

Top: total, critical (open), pending, assigned, available responders. Centre: the map. Side panel: filters, the critical incident queue (open critical incidents, oldest first; deliberately **not** filtered so an open critical incident cannot be filtered out of sight), recent incidents, and the incidents without a position. Clicking an incident in a list selects its marker and moves the map to it. Below: the existing pending queue, dispatch actions, incident management, responder panel and platform health, all unchanged in behaviour.

**Filters:** type, severity, status and "reported within" (any time, last hour, last 24 hours, last 7 days, from each incident's `createdAt`). They change the visible markers immediately; "Reset filters" restores the defaults; the panel shows "Showing x of y".

## Reporting with a position (location picker)

On **Report emergency**, below the location text:

1. **Search** a place (press Search or Enter; no search-as-you-type), or press **Use my location** (the browser asks for permission; it is never requested automatically), or simply pan and zoom.
2. **Click** the map to place the pin; **drag** the pin to refine it. The selected coordinates are shown, and **Clear position** removes them.
3. Choosing a search result also fills the location description if it is still empty; the text can be edited and remains required, as before.
4. Submit. `latitude` and `longitude` are sent **together**, rounded to 6 decimals, only if a valid position was chosen. The confirmation says whether a position was saved.

The position is optional. A report without a pin is sent exactly as before and shows "No map position was sent". The map initially shows a default area (Bengaluru); the interface says this is **not** the user's location, and nothing reads the device location unless the button is pressed. Server-side validation messages for latitude or longitude are shown next to the picker.

## Automatic updates

The dashboard loads incidents with the existing polling hook (`GET /api/incidents`, default every 5 seconds, adjustable in Settings): one request at a time (a new request cancels an unfinished one), paused while the browser tab is hidden. A new incident appears on the map at the next refresh (observed: about one second after it was created, with the existing markers unmoved). If a refresh fails, the markers already shown stay, a banner says the data may be out of date and offers "Try again", and the banner disappears by itself when the connection returns. There is no WebSocket in this project, so this is polling, not a push channel.

## OpenStreetMap use

* Tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, requested by the browser only for the visible part of the map. Nothing is downloaded in bulk or pre-cached.
* Attribution "© OpenStreetMap contributors" (linked to the copyright page) is always visible; do not remove it.
* The public tile service has no service-level guarantee and a usage policy (https://operations.osmfoundation.org/policies/tiles/). For heavier use, change the tile provider by setting `VITE_MAP_TILE_URL` (and `VITE_MAP_ATTRIBUTION`) in `frontend/.env`; no code changes are needed.
* **Place search** uses OpenStreetMap Nominatim (`VITE_GEOCODER_URL`). It runs only when the user presses Search, at most one request per second, with plain `fetch` and **no credentials**: the application's Axios client, which adds the user's JWT, is never used for third-party requests. What the user types in the search box is sent to the geocoder, which is stated next to the search field's purpose and is the reason it is explicit.
* The map needs internet access from the browser (tiles and search). The backend, the gateway and the Kubernetes deployment are unaffected.

## Responders

Responders are **not** drawn on the map. The responder service has no position for them, so any marker would be invented, and nothing reports their location. The Responders panel shows what is real: availability, type, zone, and the incident each busy responder is handling (a link to it).

Future work: live responder tracking would need a location-reporting capability that does not exist today: for example a `latitude`/`longitude`/`updatedAt` on responders, an authenticated endpoint a responder app calls to report its position (rate limited and role-restricted), exposure through the gateway, and a stale-position rule (a position older than a few minutes must not be drawn as current). Only then should responder markers be added, distinct from incident markers and clearly timestamped.

## Known limitations

* Only incidents reported **with** a position can be mapped; older incidents and reports without a pin appear in the "without a map position" list.
* The incident marker is the position the reporter chose; it is not verified against the written location.
* No marker clustering; very dense areas show overlapping markers (zoom in, or filter).
* Search quality and availability depend on the public Nominatim service; the map and the pin still work without it.
* The map is not shown to reporters (the reporter portal stays simple); it is in the administrator Operations overview.
* A position, like all incident data, is visible to administrators and to the reporter who made the incident, as before.

## Run it locally

```powershell
kubectl -n resqnet port-forward svc/api-gateway 8080:8080     # the backend
cd frontend; npm ci; npm run dev                               # http://localhost:5173 (or the next free port)
```

Sign in as `admin` (demo password in the README), open **Operations overview**. To have something to see, sign in as a reporter, open **Report emergency**, pin a position and submit.

## Tests

| Where | What | Result (25 Nov 2026) |
|---|---|---|
| `frontend/src/utils/map.test.ts` | coordinate validation (range, missing, one of two), splitting located / unlocated incidents, 6-decimal rounding, longitude wrap, marker colours, filters (type, severity, status, time window, reset), request body (no coordinates, both coordinates, invalid coordinates never sent) | 15 passed |
| `IncidentFlowTest` (incident-service) | coordinates stored, returned by create, read-back and list; reporting without coordinates returns nulls | 2 added, incident-service 21 passed |
| Live API | create with coordinates, read back; latitude 123 gives `400 VALIDATION_ERROR` with a field message | as expected |
| Browser, local dev server against the live cluster | map loads with OpenStreetMap tiles and attribution; 5 incidents with coordinates drawn at the right places and colours; grey after resolve; popup content; View details opens the detail dialog; filters change markers and reset; side lists; a newly created incident appears on its own without moving the map; picker: click, drag, search, my-location button present, coordinates stored by the backend; report without pin still works; error banner when the gateway is unreachable and recovery; no console errors; phone width (375 px) | all as described |

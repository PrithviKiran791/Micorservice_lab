import { memo, useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import type { Incident } from '../../types/api'
import type { Coordinates } from '../../utils/geo'
import { INCIDENT_TYPE_LABEL, SEVERITY_LABEL, STATUS_LABEL } from '../../utils/format'
import { IncidentPopup } from './IncidentPopup'
import { incidentIcon } from './mapIcons'

interface Props {
  incident: Incident
  position: Coordinates
  selected: boolean
  onSelect?: (id: number) => void
}

/**
 * One incident on the map, at the coordinates stored with the incident. memo: a refresh that did not change an incident
 * does not re-render its marker, so polling does not make the map flicker.
 */
export const IncidentMarker = memo(function IncidentMarker({ incident, position, selected, onSelect }: Props) {
  const icon = useMemo(() => incidentIcon(incident.type, incident.severity, incident.status, selected), [incident.type, incident.severity, incident.status, selected])
  const handlers = useMemo(() => ({ click: () => onSelect?.(incident.id) }), [onSelect, incident.id])
  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      eventHandlers={handlers}
      keyboard
      title={`Incident #${incident.id}: ${INCIDENT_TYPE_LABEL[incident.type]}, ${SEVERITY_LABEL[incident.severity]}, ${STATUS_LABEL[incident.status]}`}
      zIndexOffset={selected ? 1000 : incident.status === 'RESOLVED' ? -500 : incident.severity === 'CRITICAL' ? 200 : 0}
    >
      <Popup minWidth={230} maxWidth={260}>
        <IncidentPopup incident={incident} />
      </Popup>
    </Marker>
  )
})

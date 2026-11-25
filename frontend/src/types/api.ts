// Types that mirror docs/API_CONTRACT.md exactly. Nothing here is invented: every value below exists in the backend.

export type Role = 'USER' | 'ADMIN'

export type IncidentType = 'MEDICAL' | 'FIRE' | 'POLICE'
export type Severity = 'LOW' | 'MEDIUM' | 'CRITICAL'
/** REPORTED is a short transient state; PENDING = waiting for a responder; ASSIGNED = a responder is on it. */
export type IncidentStatus = 'REPORTED' | 'ASSIGNED' | 'PENDING' | 'RESOLVED'

export type ResponderType = 'AMBULANCE' | 'FIRE_TRUCK' | 'POLICE'
export type ResponderStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE'

export type NotificationType = 'INCIDENT_ASSIGNED' | 'INCIDENT_PENDING'

export const INCIDENT_TYPES: IncidentType[] = ['MEDICAL', 'FIRE', 'POLICE']
export const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'CRITICAL']
export const INCIDENT_STATUSES: IncidentStatus[] = ['REPORTED', 'PENDING', 'ASSIGNED', 'RESOLVED']
export const RESPONDER_TYPES: ResponderType[] = ['AMBULANCE', 'FIRE_TRUCK', 'POLICE']
export const RESPONDER_STATUSES: ResponderStatus[] = ['AVAILABLE', 'BUSY', 'OFFLINE']

// ---- auth ------------------------------------------------------------------------------------------------------
export interface AuthUser {
  id: number
  username: string
  role: Role
}

export interface LoginResponse {
  token: string
  tokenType: string
  expiresInSeconds: number
  user: AuthUser
}

export interface RegisteredUser {
  id: number
  username: string
  role: Role
  createdAt: string
}

// ---- incidents ---------------------------------------------------------------------------------------------------
export interface AssignedResponder {
  id: number
  name: string
  type: ResponderType
}

export interface Incident {
  id: number
  type: IncidentType
  severity: Severity
  status: IncidentStatus
  description: string
  locationText: string
  latitude: number | null
  longitude: number | null
  reportedBy: { userId: number; username: string }
  assignedResponder: AssignedResponder | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export interface CreateIncidentRequest {
  type: IncidentType
  severity: Severity
  description: string
  locationText: string
}

// ---- responders ---------------------------------------------------------------------------------------------------
export interface Responder {
  id: number
  name: string
  type: ResponderType
  status: ResponderStatus
  zone: string | null
  currentIncidentId: number | null
}

// ---- notifications -------------------------------------------------------------------------------------------------
export interface AppNotification {
  id: number
  userId: number
  incidentId: number
  type: NotificationType
  message: string
  read: boolean
  createdAt: string
}

// ---- errors ---------------------------------------------------------------------------------------------------------
/** The standard error body of every service and of the gateway. */
export interface ApiErrorBody {
  timestamp: string
  status: number
  error: string
  code: string
  message: string
  path: string
  details?: { field: string; message: string }[]
}

import type { CreateIncidentRequest, IncidentType, Severity } from '../types/api'
import { INCIDENT_TYPES, SEVERITIES } from '../types/api'

/**
 * Client-side checks that mirror the backend rules (docs/API_CONTRACT.md). They only give fast feedback: the backend
 * validates everything again and its answer is always the final word.
 */

/** Username: 3-50 characters, letters, digits, "_", "." and "-". */
export function validateUsername(value: string): string | undefined {
  const v = value.trim()
  if (v.length === 0) return 'Enter a username.'
  if (v.length < 3) return 'Use at least 3 characters.'
  if (v.length > 50) return 'Use at most 50 characters.'
  if (!/^[A-Za-z0-9_.-]+$/.test(v)) return "Only letters, digits, '_', '.' and '-' are allowed."
  return undefined
}

/** Password: 8-72 characters (72 is BCrypt's limit). */
export function validatePassword(value: string): string | undefined {
  if (value.length === 0) return 'Enter a password.'
  if (value.length < 8) return 'Use at least 8 characters.'
  if (value.length > 72) return 'Use at most 72 characters.'
  return undefined
}

export interface IncidentFormValues {
  type: IncidentType | ''
  severity: Severity | ''
  description: string
  locationText: string
}

export type IncidentFormErrors = Partial<Record<keyof IncidentFormValues, string>>

export function validateIncident(values: IncidentFormValues): IncidentFormErrors {
  const errors: IncidentFormErrors = {}
  if (!INCIDENT_TYPES.includes(values.type as IncidentType)) errors.type = 'Choose the type of emergency.'
  if (!SEVERITIES.includes(values.severity as Severity)) errors.severity = 'Choose how serious it is.'
  const description = values.description.trim()
  if (description.length === 0) errors.description = 'Describe what is happening.'
  else if (description.length > 500) errors.description = 'Use at most 500 characters.'
  const location = values.locationText.trim()
  if (location.length === 0) errors.locationText = 'Say where it is happening.'
  else if (location.length > 200) errors.locationText = 'Use at most 200 characters.'
  return errors
}

/** Builds the request body once the form is valid. (Latitude and longitude are optional in the API and are not collected.) */
export function toCreateRequest(values: IncidentFormValues): CreateIncidentRequest {
  return {
    type: values.type as IncidentType,
    severity: values.severity as Severity,
    description: values.description.trim(),
    locationText: values.locationText.trim(),
  }
}

import type { CreateIncidentRequest, Incident, IncidentStatus } from '../types/api'
import { http } from './http'

// /api/incidents. A USER only receives their own incidents; an ADMIN receives all of them (decided by the backend).
export const incidentService = {
  async list(status?: IncidentStatus, signal?: AbortSignal): Promise<Incident[]> {
    const { data } = await http.get<Incident[]>('/incidents', { params: status ? { status } : undefined, signal })
    return data
  },

  async get(id: number, signal?: AbortSignal): Promise<Incident> {
    const { data } = await http.get<Incident>(`/incidents/${id}`, { signal })
    return data
  },

  /** 201 with the created incident. Its status is ASSIGNED, or PENDING when no responder is available / the responder service is down. */
  async create(request: CreateIncidentRequest): Promise<Incident> {
    const { data } = await http.post<Incident>('/incidents', request)
    return data
  },

  /** ADMIN only. Retries the assignment of a PENDING incident (the result may still be PENDING). */
  async dispatch(id: number): Promise<Incident> {
    const { data } = await http.post<Incident>(`/incidents/${id}/dispatch`)
    return data
  },

  /** ADMIN only. Frees the responder and marks an ASSIGNED incident RESOLVED. */
  async resolve(id: number): Promise<Incident> {
    const { data } = await http.post<Incident>(`/incidents/${id}/resolve`)
    return data
  },
}

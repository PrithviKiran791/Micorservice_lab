import type { Responder, ResponderStatus, ResponderType } from '../types/api'
import { http } from './http'

// /api/responders is read-only in the current backend (creating responders or setting them offline is not implemented).
// It answers 503 while responder-service is down; the pages show that as an unavailable section, not a crash.
export const responderService = {
  async list(filter?: { status?: ResponderStatus; type?: ResponderType }, signal?: AbortSignal): Promise<Responder[]> {
    const { data } = await http.get<Responder[]>('/responders', { params: filter, signal })
    return data
  },

  async get(id: number, signal?: AbortSignal): Promise<Responder> {
    const { data } = await http.get<Responder>(`/responders/${id}`, { signal })
    return data
  },
}

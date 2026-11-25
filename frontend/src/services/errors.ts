import axios from 'axios'
import type { ApiErrorBody } from '../types/api'

/** One error type for the whole app, so every page can show a consistent, human-readable message. */
export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly details: { field: string; message: string }[]
  /** True when the request never got an answer (server unreachable, timeout). */
  readonly network: boolean

  constructor(message: string, status: number, code: string, details: { field: string; message: string }[] = [], network = false) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
    this.network = network
  }
}

function friendlyMessage(status: number, code: string, serverMessage: string): string {
  if (code === 'INVALID_CREDENTIALS') return 'Wrong username or password.'
  if (code === 'USERNAME_TAKEN') return 'That username is already taken. Please choose another one.'
  if (status === 401) return 'Your session has expired or is invalid. Please sign in again.'
  if (status === 403) return 'You are not allowed to do this.'
  if (status === 404) return 'Not found.'
  if (status === 503) return 'A backend service is temporarily unavailable. Other parts of the system keep working.'
  if (status >= 500) return 'The server had a problem. Please try again in a moment.'
  return serverMessage || 'Something went wrong.'
}

/** Converts anything thrown by Axios (or elsewhere) into an AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new AppError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR', [], true)
    }
    const body = error.response.data as Partial<ApiErrorBody> | undefined
    const status = error.response.status
    const code = typeof body?.code === 'string' ? body.code : 'HTTP_' + status
    const serverMessage = typeof body?.message === 'string' ? body.message : ''
    return new AppError(friendlyMessage(status, code, serverMessage), status, code, Array.isArray(body?.details) ? body.details : [])
  }
  return new AppError(error instanceof Error ? error.message : 'Unexpected error.', 0, 'UNKNOWN')
}

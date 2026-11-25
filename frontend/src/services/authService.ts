import type { AuthUser, LoginResponse, RegisteredUser } from '../types/api'
import { http } from './http'

// POST /api/auth/login, POST /api/auth/register (public) and GET /api/auth/me (needs a token).
export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>('/auth/login', { username, password })
    return data
  },

  async register(username: string, password: string): Promise<RegisteredUser> {
    const { data } = await http.post<RegisteredUser>('/auth/register', { username, password })
    return data
  },

  async me(signal?: AbortSignal): Promise<AuthUser> {
    const { data } = await http.get<AuthUser>('/auth/me', { signal })
    return data
  },
}

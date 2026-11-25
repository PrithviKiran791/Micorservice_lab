import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../../contexts/AuthContext'
import { tokenStore } from '../../services/tokenStore'
import { fakeJwt } from '../../test/fixtures'
import type { Role } from '../../types/api'
import { GuestRoute, HomeRedirect, ProtectedRoute, RoleRoute } from './RouteGuards'

function signIn(role: Role) {
  tokenStore.set({ token: fakeJwt(4_000_000_000), user: { id: 1, username: 'tester', role }, expiresAt: Date.now() + 3_600_000 })
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<p>landing</p>} />
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<p>login page</p>} />
          </Route>
          <Route path="/app" element={<ProtectedRoute />}>
            <Route index element={<HomeRedirect />} />
            <Route path="overview" element={<p>user overview</p>} />
            <Route element={<RoleRoute role="ADMIN" />}>
              <Route path="admin" element={<p>admin dashboard</p>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

describe('route guards', () => {
  it('sends a signed-out visitor from a protected page to the login page', () => {
    renderAt('/app/overview')
    expect(screen.getByText('login page')).toBeTruthy()
  })

  it('lets a signed-in user see the user pages', () => {
    signIn('USER')
    renderAt('/app/overview')
    expect(screen.getByText('user overview')).toBeTruthy()
  })

  it('keeps a regular user out of the admin page (they are redirected to their own home)', () => {
    signIn('USER')
    renderAt('/app/admin')
    expect(screen.queryByText('admin dashboard')).toBeNull()
    expect(screen.getByText('user overview')).toBeTruthy()
  })

  it('lets an administrator into the admin page', () => {
    signIn('ADMIN')
    renderAt('/app/admin')
    expect(screen.getByText('admin dashboard')).toBeTruthy()
  })

  it('sends each role to its own home page from /app', () => {
    signIn('ADMIN')
    renderAt('/app')
    expect(screen.getByText('admin dashboard')).toBeTruthy()
    cleanup()
    sessionStorage.clear()
    signIn('USER')
    renderAt('/app')
    expect(screen.getByText('user overview')).toBeTruthy()
  })

  it('does not show the login page to somebody who is already signed in', () => {
    signIn('USER')
    renderAt('/login')
    expect(screen.queryByText('login page')).toBeNull()
    expect(screen.getByText('user overview')).toBeTruthy()
  })
})

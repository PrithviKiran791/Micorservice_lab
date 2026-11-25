import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../contexts/AuthContext'
import { SettingsProvider } from '../contexts/SettingsContext'
import { ToastProvider } from '../contexts/ToastContext'
import { AppLayout } from '../layouts/AppLayout'
import Landing from './Landing'
import Login from './Login'
import NotFound from './NotFound'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

describe('Landing and Login glassmorphism + CloudShader pages', () => {
  it('renders the landing page with CloudShader canvas, glassmorphic navbar, and hero', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Landing />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(container.querySelector('canvas')).not.toBeNull()
    expect(container.querySelector('.light-rays__canvas')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Page sections' })).toBeTruthy()
    expect(screen.queryByText('Emergency response platform')).toBeNull()
    expect(screen.getByText('Coordinate emergency response, even when parts of the system fail.')).toBeTruthy()
    expect(screen.getAllByText('Log in').length).toBeGreaterThan(0)
    expect(screen.getByText('Register')).toBeTruthy()
  })

  it('renders the login page with CloudShader canvas, glassmorphic navbar, and sign-in form', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(container.querySelector('canvas')).not.toBeNull()
    expect(container.querySelector('.light-rays__canvas')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Authentication navigation' })).toBeTruthy()
    expect(screen.getByLabelText('Username')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
  })

  it('renders sky-coloured LightRays backdrop in AppLayout and NotFound', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/app/overview']}>
        <SettingsProvider>
          <ToastProvider>
            <AuthProvider>
              <Routes>
                <Route path="/app" element={<AppLayout />}>
                  <Route path="overview" element={<p>overview content</p>} />
                </Route>
              </Routes>
            </AuthProvider>
          </ToastProvider>
        </SettingsProvider>
      </MemoryRouter>,
    )

    expect(container.querySelector('.light-rays__canvas')).not.toBeNull()
    expect(screen.getByText('overview content')).toBeTruthy()
    cleanup()

    const { container: notFoundContainer } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )
    expect(notFoundContainer.querySelector('.light-rays__canvas')).not.toBeNull()
  })
})

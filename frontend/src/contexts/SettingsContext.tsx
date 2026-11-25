import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * The only real user setting: how often the pages refresh their data. (The backend has no push channel, so the app
 * uses polling; 0 switches automatic refresh off.) It is remembered in localStorage.
 */
export const POLL_OPTIONS = [
  { ms: 3000, label: 'Every 3 seconds' },
  { ms: 5000, label: 'Every 5 seconds' },
  { ms: 10000, label: 'Every 10 seconds' },
  { ms: 30000, label: 'Every 30 seconds' },
  { ms: 0, label: 'Off (refresh manually)' },
] as const

const KEY = 'resqnet.pollMs'
const DEFAULT_MS = 5000

interface SettingsState {
  pollMs: number
  setPollMs: (ms: number) => void
}

const SettingsContext = createContext<SettingsState>({ pollMs: DEFAULT_MS, setPollMs: () => undefined })

function readInitial(): number {
  try {
    const stored = Number(localStorage.getItem(KEY))
    return POLL_OPTIONS.some((o) => o.ms === stored) && localStorage.getItem(KEY) !== null ? stored : DEFAULT_MS
  } catch {
    return DEFAULT_MS
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [pollMs, setPoll] = useState<number>(readInitial)

  const value = useMemo<SettingsState>(
    () => ({
      pollMs,
      setPollMs: (ms: number) => {
        setPoll(ms)
        try {
          localStorage.setItem(KEY, String(ms))
        } catch {
          /* ignore: the setting just will not persist */
        }
      },
    }),
    [pollMs],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsState {
  return useContext(SettingsContext)
}

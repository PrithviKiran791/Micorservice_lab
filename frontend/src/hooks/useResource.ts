import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '../contexts/SettingsContext'
import { toAppError, type AppError } from '../services/errors'

export interface Resource<T> {
  data: T | null
  /** The last error, or null. Old data is kept while a refresh fails, so the page does not go blank. */
  error: AppError | null
  /** True only until the first answer (success or failure) arrives. */
  loading: boolean
  /** True while a background refresh is running. */
  refreshing: boolean
  lastUpdated: number | null
  reload: () => Promise<void>
}

interface Options {
  /** Refresh automatically at the interval chosen in Settings (default true). */
  poll?: boolean
  enabled?: boolean
}

/**
 * Loads data from the API and keeps it fresh by polling (the backend has no WebSocket or push channel).
 * Polling pauses while the browser tab is hidden and runs again as soon as it becomes visible.
 */
export function useResource<T>(fetcher: (signal: AbortSignal) => Promise<T>, options: Options = {}): Resource<T> {
  const { poll = true, enabled = true } = options
  const { pollMs } = useSettings()

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  // The latest fetcher is read through a ref, so changing it never restarts the polling timer.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    const id = ++requestId.current
    setRefreshing(true)
    try {
      const result = await fetcherRef.current(ctrl.signal)
      if (id !== requestId.current) return
      setData(result)
      setError(null)
      setLastUpdated(Date.now())
    } catch (e) {
      if (id !== requestId.current || ctrl.signal.aborted) return
      setError(toAppError(e))
    } finally {
      if (id === requestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
    return () => controller.current?.abort()
  }, [enabled, load])

  useEffect(() => {
    if (!enabled || !poll || pollMs <= 0) return
    const timer = window.setInterval(() => {
      if (!document.hidden) void load()
    }, pollMs)
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, poll, pollMs, load])

  return { data, error, loading, refreshing, lastUpdated, reload: load }
}

import { useSyncExternalStore } from 'react'
import { servedBy } from '../services/servedBy'

/** Name of the pod (copy of a service) that answered the latest request. */
export function useServedBy(): string {
  return useSyncExternalStore(servedBy.subscribe, servedBy.get)
}

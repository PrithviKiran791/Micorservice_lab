/**
 * Every backend answer carries an "X-Served-By: <pod name>" header (added by each service). This tiny store keeps the
 * latest value so the layout can show which copy of a service answered, which makes the load balancing visible.
 */
type Listener = () => void

let current = ''
const listeners = new Set<Listener>()

export const servedBy = {
  set(value: string): void {
    if (value && value !== current) {
      current = value
      listeners.forEach((l) => l())
    }
  },
  get(): string {
    return current
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

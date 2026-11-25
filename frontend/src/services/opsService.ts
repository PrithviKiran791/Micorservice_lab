import type { OpsHealth, OpsKubernetes, OpsResilience, OpsTraffic } from '../types/ops'
import { http } from './http'

// Administrator-only observability endpoints, answered by the API gateway itself (see docs/INTEGRATION_AUDIT.md).
// A regular user gets 403 and an anonymous caller 401; the UI only shows these pages to administrators anyway.
export const opsService = {
  async health(signal?: AbortSignal): Promise<OpsHealth> {
    return (await http.get<OpsHealth>('/ops/health', { signal })).data
  },
  async resilience(signal?: AbortSignal): Promise<OpsResilience> {
    return (await http.get<OpsResilience>('/ops/resilience', { signal })).data
  },
  async traffic(signal?: AbortSignal): Promise<OpsTraffic> {
    return (await http.get<OpsTraffic>('/ops/traffic', { signal })).data
  },
  async kubernetes(signal?: AbortSignal): Promise<OpsKubernetes> {
    return (await http.get<OpsKubernetes>('/ops/kubernetes', { signal })).data
  },
}

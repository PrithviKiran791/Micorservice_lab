// Shapes of the administrator-only operations API (GET /api/ops/*), answered by the API gateway.
// Every value comes from a live source (Eureka, /actuator of each instance, the Kubernetes API); see docs/INTEGRATION_AUDIT.md.

export type HealthState = 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN' | 'UNREACHABLE' | 'OUT_OF_SERVICE'

export interface OpsInstance {
  instanceId: string
  address: string
  eurekaStatus: string
  health: HealthState | string
  responseMs: number
  /** Health components reported by the instance (names and UP/DOWN only), for example db, rabbit. */
  components: Record<string, string>
}

export interface OpsService {
  name: string
  status: HealthState
  reason?: string
  registeredInstances: number
  healthyInstances: number
  lastHealthyAt: string | null
  instances: OpsInstance[]
}

export interface OpsHealth {
  generatedAt: string
  source: string
  discovery: {
    health: HealthState | string
    registryReadable: boolean
    responseMs: number
    registeredApplications: { name: string; instances: number; up: number }[]
  }
  services: OpsService[]
  databases: { service: string; database: string; status: HealthState }[]
  rabbitmq: { status: HealthState; reportedBy: { service: string; role: string; status: HealthState }[] }
}

export interface CircuitBreakerSnapshot {
  state: string
  failureRate: string
  failureRateThreshold?: string
  bufferedCalls?: number
  failedCalls?: number
  notPermittedCalls?: number
  slowCalls?: number
}

export interface CircuitBreakerEvent {
  name: string
  type: string
  time: string
  stateTransition?: string
  errorMessage?: string
}

export interface OpsResilienceInstance {
  instanceId: string
  address: string
  available: boolean
  reason?: string
  circuitBreakers?: Record<string, CircuitBreakerSnapshot>
  events?: CircuitBreakerEvent[]
}

export interface OpsResilience {
  generatedAt: string
  registryReadable: boolean
  instances: OpsResilienceInstance[]
}

export interface OpsTrafficInstance {
  service: string
  instanceId: string
  address: string
  available: boolean
  reason?: string
  /** Request counts per URI template, since that pod started. */
  requests?: Record<string, number>
}

export interface OpsTraffic {
  generatedAt: string
  registryReadable: boolean
  instances: OpsTrafficInstance[]
}

export interface K8sDeployment { name: string; desired: number; ready: number; available: number; updated: number; image: string }
export interface K8sPod { name: string; app: string; phase: string; ready: boolean; restarts: number; startedAt: string; terminating: boolean }
export interface K8sService { name: string; type: string; ports: { port: number; nodePort?: number }[] }

export interface OpsKubernetes {
  generatedAt: string
  namespace: string
  available: boolean
  reason?: string
  deployments?: K8sDeployment[]
  pods?: K8sPod[]
  services?: K8sService[]
}

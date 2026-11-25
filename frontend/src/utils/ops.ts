import type { OpsHealth, OpsService } from '../types/ops'

export const SERVICE_LABEL: Record<string, string> = {
  'api-gateway': 'API Gateway',
  'auth-service': 'Auth Service',
  'incident-service': 'Incident Service',
  'responder-service': 'Responder Service',
  'notification-service': 'Notification Service',
  'discovery-service': 'Discovery Service (Eureka)',
}

export const labelOf = (name: string): string => SERVICE_LABEL[name] ?? name

export function serviceByName(health: OpsHealth | null, name: string): OpsService | undefined {
  return health?.services.find((s) => s.name === name)
}

/** "incident-service-6cfbdbfbb9-x8ksz:incident-service:8082" -> "incident-service-6cfbdbfbb9-x8ksz" (the pod name). */
export function podName(instanceId: string): string {
  return instanceId.split(':')[0]
}

/** Sum of the request counts of one instance. */
export function totalRequests(requests: Record<string, number> | undefined): number {
  return Object.values(requests ?? {}).reduce((a, b) => a + b, 0)
}

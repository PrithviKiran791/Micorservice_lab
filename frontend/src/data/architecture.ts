// The real architecture of AegisFlow, as read from the code and manifests (docs/INTEGRATION_AUDIT.md section 1).
// This is design information, not live data: the Architecture page labels it so and adds live health where the
// operations API provides it.

export type EdgeKind = 'rest' | 'async' | 'discovery' | 'database'

export interface ArchNode {
  id: string
  label: string
  sub?: string
  x: number
  y: number
  w: number
  h: number
  responsibility: string
  technology: string
  endpoints: string[]
  /** Name used by the operations API (services) or a special key for infrastructure. */
  healthKey?: string
}

export interface ArchEdge {
  from: string
  to: string
  kind: EdgeKind
  label: string
}

export const EDGE_STYLE: Record<EdgeKind, { label: string; color: string; dash?: string; width: number; what: string }> = {
  rest: { label: 'Synchronous REST', color: '#3b82f6', width: 2, what: 'The caller waits for the answer (HTTP).' },
  async: { label: 'Asynchronous RabbitMQ event', color: '#f59e0b', dash: '7 5', width: 2, what: 'Fire and forget: the publisher does not wait for the consumer.' },
  discovery: { label: 'Service discovery (Eureka)', color: '#38bdf8', dash: '2 5', width: 1.5, what: 'Registration, heartbeat every 5 s, and lookup of other services.' },
  database: { label: 'Database connection (JDBC)', color: '#22c55e', dash: '12 4 2 4', width: 1.5, what: 'Each service connects only to its own database.' },
}

export const NODES: ArchNode[] = [
  {
    id: 'browser', label: 'Browser', sub: 'React app', x: 500, y: 40, w: 150, h: 50,
    responsibility: 'Shows the reporter portal and the administrator command center. It only ever talks to the API gateway under /api.',
    technology: 'React, TypeScript, Vite, Tailwind, Axios',
    endpoints: ['GET / (pages)', '/api/** (data)'],
  },
  {
    id: 'gateway', label: 'API Gateway', sub: 'x2 replicas', x: 500, y: 150, w: 170, h: 56, healthKey: 'api-gateway',
    responsibility: 'The single public entry point. Verifies the JWT, strips forged identity headers, routes by path with load balancing and retries failed GETs on another replica. Serves the UI and the operations API.',
    technology: 'Spring Cloud Gateway (reactive), jjwt, Spring Cloud LoadBalancer',
    endpoints: ['/api/auth/**', '/api/incidents/**', '/api/responders/**', '/api/notifications/**', '/api/ops/* (admin only)', 'GET / (UI)', '/actuator/health'],
  },
  {
    id: 'frontend', label: 'Frontend', sub: 'nginx', x: 190, y: 150, w: 150, h: 50, healthKey: 'frontend',
    responsibility: 'Serves the built static files and falls back to index.html for client-side routes. Reached only through the gateway.',
    technology: 'nginx (Docker image), Kubernetes ClusterIP service',
    endpoints: ['GET /', '/assets/*', '/healthz'],
  },
  {
    id: 'eureka', label: 'Discovery', sub: 'Eureka', x: 830, y: 150, w: 150, h: 56, healthKey: 'discovery-service',
    responsibility: 'The service registry. Services register and renew their lease; the gateway and the incident service look up live instances by name, so a dead pod stops receiving traffic.',
    technology: 'Spring Cloud Netflix Eureka Server',
    endpoints: ['/eureka/apps (cluster-internal)', '/actuator/health'],
  },
  {
    id: 'auth', label: 'Auth Service', x: 120, y: 300, w: 160, h: 56, healthKey: 'auth-service',
    responsibility: 'Registers users (role always USER), checks passwords (BCrypt) and issues signed JWTs.',
    technology: 'Spring Boot, Spring Data JPA, spring-security-crypto, jjwt',
    endpoints: ['POST /auth/register', 'POST /auth/login', 'GET /auth/me'],
  },
  {
    id: 'responder', label: 'Responder Service', x: 330, y: 300, w: 170, h: 56, healthKey: 'responder-service',
    responsibility: 'Owns ambulances, fire trucks and police units. Assigns one atomically with a row lock so no responder is given to two incidents.',
    technology: 'Spring Boot, Spring Data JPA, PostgreSQL row lock (FOR UPDATE SKIP LOCKED)',
    endpoints: ['GET /responders', 'GET /responders/{id}', 'POST /internal/responders/assign (internal)', 'POST /internal/responders/{id}/release (internal)'],
  },
  {
    id: 'incident', label: 'Incident Service', sub: 'x2 replicas', x: 560, y: 300, w: 170, h: 56, healthKey: 'incident-service',
    responsibility: 'Accepts incident reports, asks the responder service for an assignment (circuit breaker, falls back to PENDING), lets administrators dispatch and resolve, and publishes events.',
    technology: 'Spring Boot, Spring Data JPA, Resilience4j, Spring AMQP',
    endpoints: ['POST /incidents', 'GET /incidents', 'GET /incidents/{id}', 'POST /incidents/{id}/dispatch', 'POST /incidents/{id}/resolve'],
  },
  {
    id: 'notification', label: 'Notification Service', x: 800, y: 300, w: 180, h: 56, healthKey: 'notification-service',
    responsibility: 'Consumes incident events from RabbitMQ and stores one notification per event for the reporter. Duplicate events are ignored.',
    technology: 'Spring Boot, Spring Data JPA, Spring AMQP listener',
    endpoints: ['GET /notifications', 'PATCH /notifications/{id}/read'],
  },
  {
    id: 'rabbit', label: 'RabbitMQ', sub: 'events', x: 680, y: 420, w: 130, h: 50, healthKey: 'rabbitmq',
    responsibility: 'Message broker between the incident and notification services. The incident service publishes after saving; the notification service consumes at its own pace.',
    technology: 'RabbitMQ 3 (topic exchange, routing key incident.*)',
    endpoints: ['AMQP 5672 (cluster-internal)', 'management UI 15672 (not exposed)'],
  },
  {
    id: 'postgres', label: 'PostgreSQL', sub: 'auth_db | incident_db | responder_db | notification_db', x: 455, y: 530, w: 780, h: 50, healthKey: 'postgres',
    responsibility: 'One PostgreSQL server with four separate databases and users (database per service). A user can connect only to its own database.',
    technology: 'PostgreSQL 16 with a persistent volume',
    endpoints: ['5432 (cluster-internal)'],
  },
]

export const EDGES: ArchEdge[] = [
  { from: 'browser', to: 'gateway', kind: 'rest', label: 'HTTP: page and /api/**' },
  { from: 'gateway', to: 'frontend', kind: 'rest', label: 'GET / (static files)' },
  { from: 'gateway', to: 'auth', kind: 'rest', label: '/api/auth/** (lb://auth-service)' },
  { from: 'gateway', to: 'incident', kind: 'rest', label: '/api/incidents/** (lb://incident-service)' },
  { from: 'gateway', to: 'responder', kind: 'rest', label: '/api/responders/** (lb://responder-service)' },
  { from: 'gateway', to: 'notification', kind: 'rest', label: '/api/notifications/** (lb://notification-service)' },
  { from: 'incident', to: 'responder', kind: 'rest', label: 'assign / release (circuit breaker, timeout 2 s)' },
  { from: 'incident', to: 'rabbit', kind: 'async', label: 'publishes incident.* events' },
  { from: 'rabbit', to: 'notification', kind: 'async', label: 'delivers events to the listener' },
  { from: 'gateway', to: 'eureka', kind: 'discovery', label: 'fetches the instance list' },
  { from: 'auth', to: 'eureka', kind: 'discovery', label: 'registers + heartbeat' },
  { from: 'incident', to: 'eureka', kind: 'discovery', label: 'registers + heartbeat + lookup' },
  { from: 'responder', to: 'eureka', kind: 'discovery', label: 'registers + heartbeat' },
  { from: 'notification', to: 'eureka', kind: 'discovery', label: 'registers + heartbeat' },
  { from: 'auth', to: 'postgres', kind: 'database', label: 'auth_db' },
  { from: 'responder', to: 'postgres', kind: 'database', label: 'responder_db' },
  { from: 'incident', to: 'postgres', kind: 'database', label: 'incident_db' },
  { from: 'notification', to: 'postgres', kind: 'database', label: 'notification_db' },
]

import type { CriterionId } from '../utils/labEvaluation'
import { DATABASE_ISOLATION, FAILOVER, LOAD_TEST, OTHER_TESTING, REHEARSAL, type EvidenceItem } from './evidence'

export interface Criterion {
  id: CriterionId
  number: number
  name: string
  description: string
  /** How it is implemented, with the files where it can be seen (design information from the repository). */
  implementation: string[]
  /** Architecture components involved. */
  components: string[]
  /** Recorded results from the repository. */
  evidence: EvidenceItem[]
  /** How to demonstrate it. Commands are PowerShell. */
  demo: string[]
}

const pick = (...parts: string[]): EvidenceItem[] => REHEARSAL.filter((r) => parts.some((p) => r.what.startsWith(p)))

export const CRITERIA: Criterion[] = [
  {
    id: 'deployment', number: 1, name: 'Deployment',
    description: 'All services run containerised on Kubernetes (Minikube) in the namespace resqnet, with health probes, and the API gateway is the only public entry point.',
    implementation: [
      'One Dockerfile per service (for example incident-service/Dockerfile); images are tagged resqnet/<service>:1.0 and loaded into Minikube.',
      'Manifests in k8s/ (namespace, secrets, config, PostgreSQL, RabbitMQ, discovery, four services, gateway, frontend); k8s/30-gateway.yaml exposes only the gateway as NodePort.',
      'Liveness, readiness and startup probes on /actuator/health; scripts/deploy-minikube.ps1 builds, loads, applies and waits.',
    ],
    components: ['Docker', 'Kubernetes / Minikube', 'API Gateway', 'every service'],
    evidence: [REHEARSAL[0]],
    demo: ['kubectl -n resqnet get deploy,pods,svc', 'Open Service health > Kubernetes on this site (live view of the same information).'],
  },
  {
    id: 'traffic', number: 2, name: 'Traffic handling and load balancing',
    description: 'Several copies of the busy services share the traffic; a dead copy does not interrupt users.',
    implementation: [
      'api-gateway and incident-service run 2 replicas each (k8s/30-gateway.yaml, k8s/21-incident.yaml).',
      'GatewayRoutes.java routes with lb://<service>: Spring Cloud LoadBalancer picks an instance from Eureka for every request (round-robin).',
      'GET requests that hit a dead copy are retried on another (GatewayRoutes.java); POST is never retried, so no incident is created twice.',
    ],
    components: ['API Gateway (2 replicas)', 'Incident Service (2 replicas)', 'Eureka', 'Spring Cloud LoadBalancer'],
    evidence: [
      { what: `Load test: ${LOAD_TEST.summary.map((s) => s.join(' ')).join('; ')}`, result: `Incident pods answered ${LOAD_TEST.distribution.map((d) => `${d.requests} (${d.share}%)`).join(' and ')}`, source: LOAD_TEST.source, date: LOAD_TEST.date },
      { what: 'Pod deleted under traffic', result: `${FAILOVER.before} ${FAILOVER.after}`, source: FAILOVER.source, date: '25 Nov 2026' },
    ],
    demo: [LOAD_TEST.command, 'Then open Service health > Load balancing: the request counters of the two incident pods rise.'],
  },
  {
    id: 'database', number: 3, name: 'Database integration',
    description: 'Every service has its own PostgreSQL database and user (database per service); incidents survive restarts.',
    implementation: [
      'db/init-databases.sh (also embedded in k8s/02-config.yaml) creates auth_db, incident_db, responder_db and notification_db with four users and revokes public CONNECT.',
      'Each service uses Spring Data JPA against its own database only; no shared entities.',
      'Readiness of every business service includes the db health check (application.yml).',
    ],
    components: ['PostgreSQL', 'Auth, Incident, Responder, Notification services'],
    evidence: [DATABASE_ISOLATION, { what: 'Smoke test: an incident is created, read back and listed', result: '37 passed, 0 failed', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' }],
    demo: ['kubectl -n resqnet exec deploy/postgres -- psql -U postgres -c "\\l"', 'Service health > Databases shows each service\'s own connection check.'],
  },
  {
    id: 'communication', number: 4, name: 'Inter-service communication',
    description: 'One synchronous REST call (incident to responder) and one asynchronous event (incident to notification through RabbitMQ).',
    implementation: [
      'Synchronous: incident-service/.../client/ResponderClient.java calls POST /internal/responders/assign with a 2 s read timeout and a circuit breaker.',
      'Asynchronous: IncidentEventPublisher.java publishes incident.assigned / incident.pending after the incident is saved; notification-service IncidentEventListener.java consumes it.',
      'The gateway never routes /internal/**; duplicate events are ignored by a unique eventId.',
    ],
    components: ['Incident Service', 'Responder Service', 'RabbitMQ', 'Notification Service'],
    evidence: pick('Smoke test', 'Postman'),
    demo: ['As a reporter: report an incident (Report emergency).', 'Within seconds the Notifications page shows "assigned to ..." (the event arrived through RabbitMQ).'],
  },
  {
    id: 'resilience', number: 5, name: 'Resilience',
    description: 'When the responder service is down, the rest of the system still answers and incidents are accepted as PENDING; after recovery an administrator dispatches them.',
    implementation: [
      'ResponderClient.java: @CircuitBreaker(name = "responderService") with a fallback that returns "no responder"; the incident is saved as PENDING.',
      'incident-service application.yml: window 5, minimum 3 calls, opens at 50% failures, 10 s open, 2 half-open probe calls; only real infrastructure errors count.',
      'scripts/demo-resilience.ps1 scales responder-service to 0 and back and checks every step.',
    ],
    components: ['Incident Service', 'Resilience4j circuit breaker', 'Responder Service', 'Admin dashboard'],
    evidence: pick('Resilience demo', 'Failover demo'),
    demo: ['kubectl -n resqnet scale deploy/responder-service --replicas=0', 'Report an incident as a reporter: it becomes PENDING. Watch Service health > Resilience.', 'kubectl -n resqnet scale deploy/responder-service --replicas=1', 'As admin: Dispatch the pending incident: it becomes ASSIGNED.'],
  },
  {
    id: 'discovery', number: 6, name: 'Service discovery and API gateway',
    description: 'Services register in Eureka; the gateway is the single entry point and finds instances by name.',
    implementation: [
      'discovery-service is a Eureka server; every other service registers and renews its lease every 5 s (eureka config in each application.yml).',
      'GatewayRoutes.java: /api/auth, /incidents, /responders, /notifications go to lb://<service-name>; JwtAuthenticationFilter checks every request.',
      'A stopped service is evicted from the registry after 15 s, so the load balancer stops using it.',
    ],
    components: ['Discovery Service (Eureka)', 'API Gateway', 'all registered services'],
    evidence: pick('Smoke test', 'Failover demo'),
    demo: ['Service health > Discovery: registered applications and instance counts.', 'kubectl -n resqnet delete pod <an incident-service pod>: the list shrinks, then recovers.'],
  },
  {
    id: 'security', number: 7, name: 'Security',
    description: 'Authentication is checked at the gateway with JWT; passwords are hashed with BCrypt; roles USER and ADMIN are enforced.',
    implementation: [
      'JwtAuthenticationFilter.java (gateway): verifies HS256 signature, issuer and expiry; strips forged X-User-* headers; answers 401 itself.',
      'AuthService.java (auth-service): BCrypt hashing, role always USER at registration.',
      'CurrentUser.requireAdmin() in incident-service: 403 for dispatch and resolve unless ADMIN; /api/ops/* admin only at the gateway.',
    ],
    components: ['API Gateway (JWT filter)', 'Auth Service (BCrypt, token issue)', 'Incident Service (roles)'],
    evidence: [{ what: 'Smoke test: missing, garbage, expired, wrong-secret, wrong-issuer and unknown-role tokens all rejected; USER gets 403; forged role header refused', result: '37 passed, 0 failed', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' }],
    demo: ['Open the Security page and press "Run basic checks" and "Run reporter checks": each row shows the real HTTP status.'],
  },
  {
    id: 'testing', number: 8, name: 'Testing',
    description: 'Unit tests per service, integration tests through the gateway, API tests, load tests and resilience tests, with recorded results.',
    implementation: [
      'JUnit 5 tests in every service (Mockito and Testcontainers with real PostgreSQL); scripts/run-unit-tests.ps1 runs them all.',
      'scripts/smoke-test.ps1, the Postman collection (newman), scripts/load-test.ps1, scripts/demo-resilience.ps1 and demo-failover.ps1.',
      'scripts/rehearsal.ps1 runs all of the above from a clean cluster.',
    ],
    components: ['JUnit / Testcontainers', 'newman (Postman)', 'PowerShell test scripts'],
    evidence: OTHER_TESTING,
    demo: ['.\\scripts\\run-unit-tests.ps1', '.\\scripts\\smoke-test.ps1', '(.\\scripts\\rehearsal.ps1 deletes the namespace and rebuilds: run it only deliberately.)'],
  },
]

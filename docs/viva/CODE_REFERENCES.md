# Code references (generated)

Every row gives the file, the exact line number and the code snippet found there, so you can open the file and point at it during the viva.

- Generated from the real source by `scripts/generate-references.ps1` (line numbers are never typed by hand).
- Checked by `scripts/verify-references.ps1`: each snippet must really be at its line. If you edit code, run both scripts again.
- Line numbers can shift after edits; the class and method names in the fourth column stay valid.

## Atomic assignment (responder-service)

| Concept | File:line | Snippet | Class / method | Rubric row |
|---|---|---|---|---|
| The SQL that locks one free responder row | `responder-service/src/main/java/com/resqnet/responder/repository/ResponderRepository.java:39` | `FOR UPDATE SKIP LOCKED` | ResponderRepository.lockFirstAvailable | Database, Cross-service |
| Assign runs as one transaction | `responder-service/src/main/java/com/resqnet/responder/service/ResponderService.java:67` | `public AssignResponse assign(AssignRequest request)` | ResponderService.assign (@Transactional on the line above) | Cross-service |
| Idempotency: the same incident never takes a second responder | `responder-service/src/main/java/com/resqnet/responder/service/ResponderService.java:70` | `repository.findByCurrentIncidentId(incidentId)` | ResponderService.assign | Cross-service |
| Database-level guard: one incident, one responder | `responder-service/src/main/resources/schema.sql:11` | `CREATE UNIQUE INDEX IF NOT EXISTS uq_responder_current_incident` | schema.sql | Database |
| Test: 10 simultaneous assigns, only 3 ambulances | `responder-service/src/test/java/com/resqnet/responder/service/ResponderServiceConcurrencyTest.java:62` | `void concurrentAssignmentsNeverGiveTheSameResponder()` | ResponderServiceConcurrencyTest | Testing |

## Circuit breaker and fallback (incident-service)

| Concept | File:line | Snippet | Class / method | Rubric row |
|---|---|---|---|---|
| The breaker wraps the call to responder-service | `incident-service/src/main/java/com/resqnet/incident/client/ResponderClient.java:43` | `@CircuitBreaker(name = "responderService", fallbackMethod = "assignFallback")` | ResponderClient.assign | Resilience |
| The fallback: no answer means PENDING | `incident-service/src/main/java/com/resqnet/incident/client/ResponderClient.java:58` | `public Optional<AssignedResponder> assignFallback` | ResponderClient.assignFallback | Resilience |
| 409 "no responder free" is a normal answer, not a failure | `incident-service/src/main/java/com/resqnet/incident/client/ResponderClient.java:51` | `catch (HttpClientErrorException.Conflict e)` | ResponderClient.assign | Resilience |
| Breaker settings: opens at 50 % failures | `incident-service/src/main/resources/application.yml:38` | `failure-rate-threshold: 50` | resilience4j.circuitbreaker.instances.responderService | Resilience |
| Timeouts make a dead service fail fast | `incident-service/src/main/java/com/resqnet/incident/config/RestClientConfig.java:36` | `factory.setReadTimeout(readTimeoutMs);` | RestClientConfig.responderRestClient | Resilience |
| Save first, call the remote service later (no remote call inside a DB transaction) | `incident-service/src/main/java/com/resqnet/incident/service/IncidentService.java:52` | `Incident incident = repository.save(new Incident(` | IncidentService.create | Resilience |
| The synchronous call itself | `incident-service/src/main/java/com/resqnet/incident/service/IncidentService.java:121` | `responderClient.assign(new AssignRequest(` | IncidentService.tryAssign | Cross-service |
| Test: responder hangs, fallback within 3 s | `incident-service/src/test/java/com/resqnet/incident/service/IncidentFlowTest.java:161` | `void responderHangs_readTimeoutTriggersFallbackWithinAboutThreeSeconds()` | IncidentFlowTest | Testing |

## JWT at the gateway (api-gateway)

| Concept | File:line | Snippet | Class / method | Rubric row |
|---|---|---|---|---|
| Verify signature, issuer and expiry | `api-gateway/src/main/java/com/resqnet/gateway/security/JwtAuthenticationFilter.java:92` | `Jwts.parser().verifyWith(key)` | JwtAuthenticationFilter.filter | Security |
| Forged identity headers are removed | `api-gateway/src/main/java/com/resqnet/gateway/security/JwtAuthenticationFilter.java:75` | `h.remove(HEADER_ROLE);` | JwtAuthenticationFilter.filter | Security |
| The filter runs before everything else | `api-gateway/src/main/java/com/resqnet/gateway/security/JwtAuthenticationFilter.java:64` | `return Ordered.HIGHEST_PRECEDENCE;` | JwtAuthenticationFilter.getOrder | Security |
| Verified identity passed to the service | `api-gateway/src/main/java/com/resqnet/gateway/security/JwtAuthenticationFilter.java:109` | `.header(HEADER_ROLE, role)` | JwtAuthenticationFilter.filter | Security |
| Services only read headers and check roles | `incident-service/src/main/java/com/resqnet/incident/security/CurrentUser.java:34` | `public void requireAdmin()` | CurrentUser.requireAdmin | Security |
| Test: expired token is rejected | `api-gateway/src/test/java/com/resqnet/gateway/security/JwtAuthenticationFilterTest.java:81` | `void expiredTokenIsRejected()` | JwtAuthenticationFilterTest | Testing |
| Login checks the BCrypt hash | `auth-service/src/main/java/com/resqnet/auth/service/AuthService.java:64` | `passwordEncoder.matches(request.password(), u.getPasswordHash())` | AuthService.login | Security |
| Registration always creates a USER | `auth-service/src/main/java/com/resqnet/auth/service/AuthService.java:45` | `passwordEncoder.encode(request.password()), Role.USER` | AuthService.register | Security |

## Service discovery and load balancing

| Concept | File:line | Snippet | Class / method | Rubric row |
|---|---|---|---|---|
| The registry (Eureka server) | `discovery-service/src/main/java/com/resqnet/discovery/DiscoveryServiceApplication.java:12` | `@EnableEurekaServer` | DiscoveryServiceApplication | Service discovery |
| Gateway routes by service NAME, not address | `api-gateway/src/main/java/com/resqnet/gateway/config/GatewayRoutes.java:34` | `.uri("lb://incident-service"))` | GatewayRoutes.routes | Service discovery, Handles traffic |
| incident-service finds responder-service by name | `incident-service/src/main/java/com/resqnet/incident/config/RestClientConfig.java:13` | `@LoadBalanced` | RestClientConfig.loadBalancedRestClientBuilder | Service discovery |
| Every service registers with Eureka | `incident-service/src/main/resources/application.yml:66` | `defaultZone: ${EUREKA_URL:http://localhost:8761/eureka}` | application.yml (eureka.client) | Service discovery |
| Two copies of incident-service | `k8s/21-incident.yaml:8` | `replicas: 2` | Deployment incident-service | Handles traffic |
| Which pod answered (load-balancing evidence) | `incident-service/src/main/java/com/resqnet/incident/config/ServedByFilter.java:26` | `response.setHeader("X-Served-By", instanceName);` | ServedByFilter.doFilterInternal | Handles traffic |

## Asynchronous event (RabbitMQ)

| Concept | File:line | Snippet | Class / method | Rubric row |
|---|---|---|---|---|
| Publish to the exchange | `incident-service/src/main/java/com/resqnet/incident/messaging/IncidentEventPublisher.java:38` | `rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, routingKey, event);` | IncidentEventPublisher.publish | Cross-service |
| Exchange, queue and binding (declared in code) | `incident-service/src/main/java/com/resqnet/incident/messaging/RabbitConfig.java:44` | `BindingBuilder.bind(notificationQueue).to(eventsExchange).with("incident.*");` | RabbitConfig.notificationBinding | Cross-service |
| The consumer | `notification-service/src/main/java/com/resqnet/notification/messaging/IncidentEventListener.java:24` | `@RabbitListener(queues = RabbitConfig.QUEUE)` | IncidentEventListener.onIncidentEvent | Cross-service |
| Idempotent consumer: skip a known eventId | `notification-service/src/main/java/com/resqnet/notification/service/NotificationService.java:44` | `if (repository.existsByEventId(notification.getEventId()))` | NotificationService.recordEvent | Cross-service |
| Unique event_id column (second line of defence) | `notification-service/src/main/java/com/resqnet/notification/model/Notification.java:30` | `@Column(name = "event_id", nullable = false, unique = true)` | Notification.eventId | Database |
| Test: the same event never creates two notifications | `notification-service/src/test/java/com/resqnet/notification/service/NotificationServiceTest.java:87` | `void duplicateEventIdDoesNotCreateASecondNotification()` | NotificationServiceTest | Testing |

## Database per service

| Concept | File:line | Snippet | Class / method | Rubric row |
|---|---|---|---|---|
| Four users, each connects only to its own database | `db/init-databases.sh:19` | `REVOKE CONNECT ON DATABASE` | init-databases.sh | Database |
| incident-service uses only its own database | `k8s/21-incident.yaml:37` | `jdbc:postgresql://postgres:5432/incident_db` | Deployment incident-service (env) | Database |

## Docker and Kubernetes

| Concept | File:line | Snippet | Class / method | Rubric row |
|---|---|---|---|---|
| Image: Java runtime plus the jar | `auth-service/Dockerfile:2` | `FROM eclipse-temurin:17-jre` | Dockerfile | Deployed |
| Wait for Postgres before starting (init container) | `k8s/22-responder.yaml:19` | `name: wait-for-postgres` | Deployment responder-service | Deployed |
| Readiness probe: only receive traffic when healthy | `k8s/22-responder.yaml:51` | `readinessProbe:` | Deployment responder-service | Deployed |
| Only the gateway is reachable from outside | `k8s/30-gateway.yaml:57` | `type: NodePort` | Service api-gateway | Deployed, Security |
| Images are copied into Minikube (containerd runtime) | `scripts/deploy-minikube.ps1:76` | `minikube image load $image` | deploy-minikube.ps1 | Deployed |

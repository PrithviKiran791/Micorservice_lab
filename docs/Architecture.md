# Architecture - ResQNet Lite

## 1. Overview

ResQNet Lite is six Spring Boot applications (five services plus the Eureka registry) plus PostgreSQL and RabbitMQ, all running as
workloads in one Minikube namespace (`resqnet`). Clients talk only to the **API Gateway**.
The gateway authenticates the JWT and routes requests to the owning service. Services
communicate in two ways: a **synchronous REST call** (incident -> responder) and an
**asynchronous RabbitMQ event** (incident -> notification).

## 2. Component diagram

```text
                 Postman / optional static page
                              |
                              v
                 +------------------------+
                 |      API Gateway       |  :8080  (NodePort / port-forward)
                 |  JWT check, routing    |
                 +-----------+------------+
                             |   adds X-User-Id / X-User-Name / X-User-Role
        +--------------------+---------------------+------------------+
        |                    |                     |                  |
        v                    v                     v                  v
+---------------+   +----------------+   +-----------------+  +--------------------+
| auth-service  |   | incident-      |   | responder-      |  | notification-      |
|    :8081      |   | service :8082  |-->| service :8083   |  | service :8084      |
|   auth_db     |   |  incident_db   |   |  responder_db   |  |  notification_db   |
+---------------+   +-------+--------+   +-----------------+  +---------^----------+
                            |   sync REST (circuit breaker)             |
                            |                                           |
                            +--------> RabbitMQ exchange ---------------+
                                       resqnet.events (async event)

        PostgreSQL (one server, four databases, four users)   RabbitMQ (one broker)
        --------------------- all inside Minikube namespace "resqnet" ---------------------
```

Solid arrow incident -> responder is the synchronous call; the RabbitMQ path is the asynchronous event.

Not drawn above: **discovery-service** (Eureka registry, :8761). Every service registers there and sends a heartbeat every 5 s; the gateway routes by service name (lb://incident-service) and incident-service calls `http://responder-service` as a registry name through a load-balanced client, so several copies of a service share the traffic (incident-service runs 2 copies). A picture is in `docs/diagrams/01-system-architecture.png`.

## 3. Services

| Service | Port | Database | Responsibility |
|---|---|---|---|
| api-gateway | 8080 | none | Single entry point; validates JWT; routes `/api/**` by service name (`lb://`); retries failed GETs; sets identity headers; never routes `/internal/**` |
| auth-service | 8081 | `auth_db` | Register, login, issue JWT, seed admin |
| incident-service (2 replicas) | 8082 | `incident_db` | Incident lifecycle; sync call to responder-service; circuit breaker; publishes events |
| responder-service | 8083 | `responder_db` | Responder catalogue and availability; atomic assignment and release |
| notification-service | 8084 | `notification_db` | Consumes events; stores and serves notifications |
| discovery-service | 8761 | none | Eureka service registry; services register and look each other up by name |

## 4. Technology

Java 17, Spring Boot 3.x, Spring Cloud Gateway (reactive), Spring Data JPA, PostgreSQL 16,
Spring AMQP + RabbitMQ 3, Resilience4j, Spring Cloud (Netflix Eureka, LoadBalancer; BOM 2025.0.3 with Spring Boot 3.5.16), jjwt 0.12.x, Maven, Docker, Kubernetes (Minikube, docker driver with the containerd runtime).

## 5. Communication design

### 5.1 Synchronous: incident-service -> responder-service

- Why synchronous: the incident status (`ASSIGNED` vs `PENDING`) must be known in the response to the reporter.
- `POST http://responder-service/internal/responders/assign` (`responder-service` is a Eureka registry name resolved by a `@LoadBalanced` `RestClient`, not a DNS host)
  with connect timeout 1 s and read timeout 2 s.
- Wrapped in a Resilience4j `CircuitBreaker` named `responderService`
  (sliding window 5, minimum 3 calls, 50 % failure threshold, 10 s open state, 2 half-open probes).
- Fallback: mark the incident `PENDING`, publish `incident.pending`, return 201.
- A business answer of `409 NO_RESPONDER_AVAILABLE` is **not** counted as a circuit failure; it also results in `PENDING`.
- The assign endpoint is idempotent per `incidentId`, so a retry would be safe; none is configured (rule R-RS-5 allows at most one) to keep the fallback fast and the code simple.

### 5.2 Asynchronous: incident-service -> notification-service

- Why asynchronous: notifications are a side effect; dispatch must not wait for them or fail because of them.
- Exchange `resqnet.events` (topic, durable). Routing keys `incident.assigned`, `incident.pending`.
- Queue `notification.incidents` (durable) bound with `incident.*`.
- JSON payloads (see `docs/API_CONTRACT.md`, section "Events"). At-least-once delivery;
  the consumer de-duplicates on `eventId` (unique column).

### 5.3 What is NOT used

No service-to-service calls other than the two above. Notification-service never calls incident-service.
Gateway never calls anything except routing targets.

## 6. Data ownership

| Database | Owner | Tables | Notes |
|---|---|---|---|
| `auth_db` | auth-service | `users` | BCrypt hashes |
| `incident_db` | incident-service | `incidents` | Holds user id/name and responder id/name as plain values (no cross-db FK) |
| `responder_db` | responder-service | `responders` | Row lock used for assignment |
| `notification_db` | notification-service | `notifications` | `event_id` unique for idempotency |

Rules: one service = one database = one DB user. No service may connect to another service's database.
Cross-service references are *logical ids* validated through APIs/events, never foreign keys.
Full DDL in `docs/schema.md`.

## 7. Key flows

### 7.1 Report incident (happy path)

```text
Client -> Gateway: POST /api/incidents (Bearer JWT)
Gateway: validate JWT, strip inbound X-User-*, add X-User-* headers, route
Gateway -> incident-service: POST /incidents
incident-service: validate, save incident (status REPORTED), commit
incident-service -> responder-service: POST /internal/responders/assign   (sync, timeout 2s)
responder-service: SELECT ... FOR UPDATE SKIP LOCKED, set BUSY + current_incident_id, return responder
incident-service: set ASSIGNED + responder, commit
incident-service -> RabbitMQ: publish incident.assigned
incident-service -> Client (via gateway): 201 { status: ASSIGNED, assignedResponder: {...} }
RabbitMQ -> notification-service: store "Incident assigned" notification (dedupe by eventId)
```

### 7.2 Report incident (responder-service down)

```text
incident-service -> responder-service: call fails (connection refused / timeout / breaker OPEN)
incident-service: fallback -> status PENDING, commit
incident-service -> RabbitMQ: publish incident.pending
incident-service -> Client: 201 { status: PENDING, assignedResponder: null }
```
Login, list incidents and notifications continue to work because they do not depend on responder-service.

### 7.3 Dispatch a PENDING incident (admin)

`POST /api/incidents/{id}/dispatch` repeats the assign call. On success the incident becomes
`ASSIGNED` and `incident.assigned` is published. (Optional stretch: a scheduler repeats this every 30 s.)

### 7.4 Resolve incident (admin)

`POST /api/incidents/{id}/resolve` -> incident-service calls
`POST /internal/responders/{id}/release`, then sets `RESOLVED`. If responder-service is down, the call fails with 503 and the state is unchanged.

## 8. Resilience design

| Failure | Behaviour |
|---|---|
| responder-service down | Incidents accepted as `PENDING`; fast failure through timeout/breaker; rest of system answers |
| notification-service down | Events wait in RabbitMQ queue; processed when it returns |
| RabbitMQ down | Publish fails; incident is still saved. Log error, return 201 (accepted trade-off for MVP) |
| auth-service down | Existing tokens keep working (gateway validates locally); no new logins |
| incident-service pod restarts | State is in Postgres; Kubernetes restarts the pod |
| One copy of a service dies (e.g. one of two incident-service pods) | Gateway retries failed GET requests on another copy (up to 2 retries, 1 s connect timeout, 8 s response timeout); POST is never retried automatically. Measured: pod deleted under traffic, 114 of 114 GET requests returned 200, slowest 1.08 s (before the retry: 9 failures including a 30 s hang) |
| discovery-service down | Services keep using their cached copy of the registry for a while; new or dead instances are not noticed until it returns (by design, not tested) |
| Gateway down | Everything unreachable (single entry point; a second replica is possible but not deployed) |

Kubernetes provides self-healing (restarts failed containers) and readiness probes so traffic only
reaches pods that are ready.

## 9. Security architecture (summary)

- Authentication enforced **only at the gateway**; services are `ClusterIP` and unreachable from outside.
- Gateway validates HS256 signature, issuer and expiry using a shared secret from a Kubernetes Secret.
- Gateway removes any client-supplied `X-User-*` headers and sets trusted ones.
- Authorization (role checks) happens inside services using those headers.
- `/internal/**` is never routed by the gateway.
Details in `docs/AUTHENTICATION.md`.

## 10. Deployment architecture (Minikube)

Namespace `resqnet`. One manifest file per concern in `k8s/`:

| File | Contents |
|---|---|
| `00-namespace.yaml` | Namespace |
| `01-secrets.yaml` | JWT secret, DB passwords, RabbitMQ credentials |
| `02-config.yaml` | Shared ConfigMap, Postgres init script (creates 4 databases/users) |
| `10-postgres.yaml` | Postgres Deployment + PVC + Service `postgres` |
| `11-rabbitmq.yaml` | RabbitMQ Deployment + Service `rabbitmq` (5672, 15672) |
| `15-discovery.yaml` | discovery-service (Eureka) Deployment + Service (8761) |
| `20-auth.yaml` ... `23-notification.yaml` | Deployment + ClusterIP Service per service |
| `30-gateway.yaml` | Deployment + Service (NodePort 30080) |

Per workload: image `resqnet/<service>:1.0` (`imagePullPolicy: IfNotPresent`), environment from
ConfigMap/Secret, liveness `/actuator/health/liveness`, readiness `/actuator/health/readiness`,
resource requests 256Mi / limits 768Mi, `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k` (small, quick-starting JVM), a `startupProbe` (up to 450 s on a slow laptop) and an init container that waits for Postgres (and RabbitMQ for notification-service). incident-service runs 2 replicas.

Service discovery: **Eureka** for the application services (`lb://<name>` in the gateway, `http://responder-service` in incident-service); Kubernetes DNS only for infrastructure (`postgres:5432`, `rabbitmq:5672`, `discovery-service:8761`). Pods register with their pod IP (`eureka.instance.prefer-ip-address`).
Start-up order is not guaranteed; services must retry DB/broker connections (Spring Boot default behaviour plus readiness probe delays).

Access from Windows: `kubectl -n resqnet port-forward svc/api-gateway 8080:8080` then use `http://localhost:8080`.

## 11. Configuration (environment variables)

| Variable | Used by | Example / local default |
|---|---|---|
| `SERVER_PORT` | all | 808x |
| `SPRING_DATASOURCE_URL` | 4 business services | `jdbc:postgresql://localhost:5432/auth_db` |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | 4 business services | per-service user |
| `SPRING_RABBITMQ_HOST` / `_PORT` / `_USERNAME` / `_PASSWORD` | incident, notification | `localhost` / 5672 / `guest` / `guest` |
| `JWT_SECRET` | auth, gateway | 32+ characters |
| `JWT_EXPIRY_MINUTES` | auth | 120 |
| `JWT_ISSUER` | auth, gateway | `resqnet-auth` |
| `RESPONDER_SERVICE_URL` | incident | `http://responder-service` (a registry name; same locally and in the cluster) |
| `EUREKA_URL` | all services | `http://localhost:8761/eureka` locally, `http://discovery-service:8761/eureka` in the cluster |

## 12. Observability

Actuator `health` and `info` endpoints only. Logs to stdout (`kubectl logs`). Log lines for dispatch include
`incidentId`, result, and whether the fallback was used. RabbitMQ management UI (15672) can be port-forwarded to show the queue.

## 13. Architecture decisions

| # | Decision | Reason | Trade-off |
|---|---|---|---|
| D1 | One Postgres server, four databases/users | Saves RAM on Minikube | Shared server is a single point of failure |
| D2 | JWT validated at gateway, header propagation | Meets "authentication checked at gateway", simple | Services trust headers; requires network isolation |
| D3 | RestClient + Resilience4j (no Feign) | Fewer dependencies | Manual client code |
| D9 | Netflix Eureka added (discovery-service); gateway routes `lb://<name>`; `@LoadBalanced` client in incident-service (supersedes the original "no Eureka" decision) | The lab slide requires "Eureka and one gateway entry point" and load balancing | One more service to run; registry changes reach clients with a delay of a few seconds |
o Eureka\\ decision) | The lab slide requires \\Eureka and one gateway entry point\\ and load balancing | One more service to run; registry changes reach clients with a delay of a few seconds |
| D10 | Gateway retries idempotent GET only (2 retries), 1 s connect timeout | Smooth failover when a pod dies; a repeated POST could create a duplicate incident | A POST in the same second as a pod death can fail once |
| D4 | RabbitMQ instead of Kafka | Light, simple, enough for one event | Less replay/streaming capability |
| D5 | Internal endpoints under `/internal/**` not routed | Prevents external abuse of assign/release | Needs convention discipline |
| D6 | Save first, call remote, then update | Avoids holding DB transactions across network calls | Needs `REPORTED` transitional state |
| D7 | No outbox pattern | Time | Event can be lost if publish fails after commit |
| D8 | `ddl-auto=update` for schema | Fast iteration | Not production practice; Flyway is future work |

## 14. Source layout per service

```text
<service>/
  pom.xml
  Dockerfile
  src/main/java/com/resqnet/<name>/
    controller/  service/  repository/  model/  dto/  config/  client/  messaging/  exception/
  src/main/resources/application.yml   application-local.yml
  src/test/java/...
```

Dockerfile (all services):

```dockerfile
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
```
(Change `EXPOSE` to the service port.)

## 15. Likely teacher questions (quick answers)

| Question | Answer |
|---|---|
| Why microservices here? | Independent failure and deployment: responder outage must not stop reporting or login. |
| How do you ensure database-per-service? | Separate databases and users; each service's credentials only open its own database; no cross-db queries. |
| Sync vs async - why both? | Assignment result is needed immediately (sync). Notification is a side effect that should not block or fail dispatch (async). |
| What happens if responder-service dies? | Timeout/circuit breaker triggers fallback: incident saved as `PENDING`, event published, 201 returned. Admin dispatches later. |
| How is double assignment prevented? | Row-level lock `FOR UPDATE SKIP LOCKED` inside one transaction; assignment idempotent per incident. |
| Where is authentication done? | Only at the gateway; invalid tokens never reach services. Services trust identity headers set by the gateway. |
| What if someone calls a service directly? | Services are `ClusterIP`; not exposed outside the cluster. Internal endpoints are not routed by the gateway. |
| What would you improve? | Outbox pattern, Flyway migrations, mTLS or NetworkPolicy, Ingress, HPA autoscaling, per-service Postgres instances. |
| Why Kubernetes? | Deployment, self-healing, service discovery, readiness probes, easy scale up/down for the failure demo. |

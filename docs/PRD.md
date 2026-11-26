# PRD - AegisFlow

| | |
|---|---|
| Product | AegisFlow – A Scalable Microservices-Based Emergency Response and Incident Coordination Platform (simulation; formerly ResQNet Lite) |
| Context | Microservices Lab project (20 marks), Spring Boot + Kubernetes (Minikube) |
| Status | v1.1 - updated on 25 Nov 2026 to match what was built and the 8-criteria lab rubric |
| Date | 25 Nov 2026 |
| Presentation | Within ~16 hours of this document |

## 1. Summary

AegisFlow lets a user report an emergency (medical, fire, police). The system saves the
incident, asks a separate responder service for an available responder of the right type,
assigns it, and publishes an event so a notification service can record a notification.
If the responder service is unavailable, the incident is **still accepted** and marked
`PENDING`, then dispatched later. All services run as pods on Minikube behind a gateway
that authenticates every request.

This is a **simulation**. No real emergency services or real personal data are involved.

## 2. Problem and motivation

Dispatching requires several independent jobs: authenticating callers, recording incidents,
finding free responders, and notifying people. In a monolith, one failure stops everything.
Splitting these jobs into services demonstrates how a system can degrade gracefully instead
of failing completely - the core learning outcome of the lab.

## 3. Goals

| ID | Goal | Rubric link |
|---|---|---|
| G1 | Run every component on Minikube | Deployment (5) |
| G2 | Each service owns a separate database | Database (4) |
| G3 | One synchronous REST call and one asynchronous RabbitMQ event between services | Communication (4) |
| G4 | Show one service down while the others still respond | Resilience (4) |
| G5 | Reject unauthenticated requests at the gateway | Security (3) |
| G6 | Be demo-able end to end in under 5 minutes | All |
| G7 | Service discovery with Eureka and one gateway entry point | Service discovery and gateway |
| G8 | Share load between several copies of a service and show it with a multi-user load test | Handles traffic |
| G9 | JUnit tests in every service, documented in a test report | Testing |

## 4. Non-goals (explicitly out of scope)

- Real maps, routing, GPS, or live responder tracking
- Autoscaling (HPA), public cloud hosting (the public link is only a temporary tunnel to the laptop), Ingress controllers
- Redis, WebSockets, Kafka, Prometheus, Grafana
- Payments, SMS/email delivery, mobile apps
- Refresh tokens, token revocation, OAuth/OIDC
- A production-grade frontend (Postman is the primary demo client)

## 5. Users

| Persona | Description | Role |
|---|---|---|
| Reporter | A student/citizen who reports an emergency and sees its status | `USER` |
| Dispatcher | An operator who monitors all incidents, retries dispatch, resolves incidents, manages responders | `ADMIN` |

## 6. User stories and acceptance criteria

### US-1 Register and log in
As a reporter, I can create an account and log in to receive a token.
- Registering with a new username returns 201; a duplicate returns 409.
- Login with correct credentials returns a JWT; wrong credentials return 401.
- New accounts always get role `USER`. One `ADMIN` account is seeded.

### US-2 Report an incident
As a reporter, I can report an incident with type, severity, description and location.
- Invalid input returns 400 with field errors.
- A valid report returns 201 with the incident and its status.
- If a matching responder is free, status is `ASSIGNED` and the responder is shown.
- If none is free, or the responder service is unreachable, status is `PENDING`.

### US-3 Automatic assignment
As the system, I assign exactly one available responder of the matching type.
- `MEDICAL` -> `AMBULANCE`, `FIRE` -> `FIRE_TRUCK`, `POLICE` -> `POLICE`.
- Two concurrent incidents never receive the same responder.
- The responder becomes `BUSY` with `current_incident_id` set.

### US-4 Notifications
As a reporter, I receive a notification when my incident is assigned or pending.
- Notification appears via `GET /api/notifications` after the event is processed.
- Reprocessing the same event does not create a duplicate notification.

### US-5 Monitor and manage
As a dispatcher, I can list all incidents, retry dispatch of a `PENDING` incident,
resolve an `ASSIGNED` incident, and set a responder `OFFLINE`/`AVAILABLE`.
- Reporters only see their own incidents; dispatchers see all.
- Resolving frees the responder (`AVAILABLE`).
- Retry on a non-`PENDING` incident returns 409.

### US-6 Resilience
As an examiner, I can scale `responder-service` to zero and still log in, report incidents and read notifications.
- New incidents return 201 with status `PENDING` within about 3 seconds.
- `GET /api/responders` returns 503 (expected - that service is down).
- After scaling back to 1, dispatching a `PENDING` incident assigns a responder.

### US-7 Gateway security
As the platform, every request except register, login and health requires a valid JWT.
- Missing/invalid/expired token returns 401 from the gateway; the downstream service is never called.
- `USER` calling an admin-only endpoint returns 403.

## 7. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Auth service registers users (BCrypt) and issues HS256 JWTs | Must |
| FR-2 | Gateway validates JWT on all non-public routes and forwards identity headers | Must |
| FR-3 | Incident service creates, lists, retrieves, dispatches and resolves incidents | Must |
| FR-4 | Incident service calls responder service synchronously to assign a responder | Must |
| FR-5 | Responder service assigns atomically (row lock) and is idempotent per incident | Must |
| FR-6 | Incident service wraps the call in a circuit breaker with timeout and `PENDING` fallback | Must |
| FR-7 | Incident service publishes `incident.assigned` / `incident.pending` events to RabbitMQ | Must |
| FR-8 | Notification service consumes events, stores notifications, de-duplicates by `eventId` | Must |
| FR-9 | Each service uses its own PostgreSQL database and credentials | Must |
| FR-10 | Responder service lists/creates responders and changes availability | Should (listing built; create / set OFFLINE **not built**) |
| FR-11 | Notifications can be marked as read | Should |
| FR-12 | Scheduled auto-retry of `PENDING` incidents every 30 s | Could (not built; admin dispatch is manual) |
| FR-13 | Static demo page served by the gateway | Could (not built; Postman and scripts are the demo clients) |
| FR-14 | Eureka registry; gateway routes by service name; incident-service runs 2 copies | Must (added for the 8-criteria rubric) |
| FR-15 | Gateway retries failed GET requests on another copy | Should (added) |
| FR-16 | Temporary public link to the gateway (Cloudflare quick tunnel) | Could (added) |

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Whole system runs on Minikube with 4 CPU / 4 GB RAM (3 GB minimum) |
| NFR-2 | Fallback to `PENDING` completes in at most ~3 s when responder service is down |
| NFR-3 | Every service exposes `/actuator/health` with liveness/readiness probes |
| NFR-4 | Passwords stored only as BCrypt hashes; no secrets in source for real deployment |
| NFR-5 | API errors use one consistent JSON format |
| NFR-6 | A fresh cluster can be brought up with `kubectl apply -f k8s/` after images are built |
| NFR-7 | Logs include the incident id for dispatch operations |

## 9. Scope: MVP vs stretch

**MVP (must be finished before the demo):** US-1 to US-7, FR-1 to FR-9, Minikube deployment,
Postman collection, rehearsed demo.

**Stretch (only after MVP is demo-ready):** FR-10, FR-11, FR-12, FR-13 (see `docs/ui.md`),
a second replica of `incident-service` to show load balancing, NetworkPolicy for internal endpoints.

## 10. Demo script (about 5 minutes)

1. `kubectl -n resqnet get pods` - all pods `Running` and `Ready`.
2. Postman: call `GET /api/incidents` without a token -> **401** from the gateway.
3. Register a user, log in, store the token.
4. Report a `MEDICAL / CRITICAL` incident -> **201, `ASSIGNED`**, ambulance named in response.
5. `GET /api/notifications` -> "Incident assigned" notification (asynchronous event worked).
6. `kubectl -n resqnet scale deploy/responder-service --replicas=0`.
7. Log in again and report another incident -> **201, `PENDING`**. Notifications and login still work;
   `GET /api/responders` shows **503** (expected).
8. `kubectl -n resqnet scale deploy/responder-service --replicas=1`, wait until Ready.
9. As admin: `POST /api/incidents/{id}/dispatch` -> `ASSIGNED`. Show the database-per-service point:
   `kubectl -n resqnet exec` into Postgres and list the four databases.

## 11. Success metrics

- All eight lab criteria demonstrably satisfied (see the rubric table in `docs/tracker.md` and `docs/TEST_REPORT.md`).
- Demo completes without restarting any pod manually (other than the planned scale actions).
- Teacher questions about sync vs async, database-per-service and circuit breaker are answerable from `docs/Architecture.md`.

## 12. Assumptions

- A laptop with 8+ GB RAM, Windows 11, Docker Desktop (WSL2) and Minikube works.
- One shared PostgreSQL server hosting four databases with four separate users counts as
  "each service has its own database". If stricter separation is required, run one Postgres pod per service.
- Responder locations are not modelled; assignment is by type and availability only.

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Minikube image / networking issues | Lose deployment marks | Deploy to Minikube early (by hour ~10), use `minikube docker-env` |
| Not enough RAM | Pods crash | Small JVM memory settings, close other apps, 4 GB Minikube |
| Gateway route/property changes between Spring Cloud versions | Gateway does not start | Java `RouteLocator`, copy dependency versions from start.spring.io |
| Circuit breaker not tripping in demo | Resilience marks at risk | Timeout 2 s + fallback on any connection error; rehearse the scale-to-0 step twice |
| Scope creep | Not finished | Follow cut list in `docs/rules.md` |
| Event lost between DB commit and publish | Missing notification | Accepted trade-off (documented); outbox pattern named as future work |

## 14. Milestones

See `docs/tracker.md` for the hour-by-hour plan and live status.

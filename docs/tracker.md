# Tracker - ResQNet Lite

Live status board. Update it after every task (tick the box, add a line to the log).
Legend: `[ ]` not started, `[~]` in progress, `[x]` done, `[!]` blocked.

**Deadline:** presentation about 16 hours after the plan was made (25 Nov 2026). Hours below are working hours counted from the start of Phase 1; Phase 0 is the environment setup done first.

## Current status

| Item | Value |
|---|---|
| Phase | 4 done (all 7 pods Ready, events + resilience + restarts verified in Minikube); next Phase 5 |
| Next action | Phase 5: smoke-test.ps1, demo-resilience.ps1, verify-references.ps1, Postman collection, two clean-cluster runs |
| Blockers | None (GitHub push awaiting authorization) |
| Last updated | 25 Nov 2026 |

## Rubric tracker (20 marks)

| Criterion | Marks | Evidence needed | Status |
|---|---|---|---|
| Deployment | 5 | All services + Postgres + RabbitMQ `Running` on Minikube; gateway reachable | [ ] |
| Database | 4 | 4 databases, 4 users; each service only uses its own | [ ] |
| Cross-service communication | 4 | REST call incident -> responder AND RabbitMQ event -> notification | [ ] |
| Resilience | 4 | Scale responder-service to 0: incident returns `PENDING`, login/notifications still work | [ ] |
| Security | 3 | No token -> 401 at gateway; USER on admin endpoint -> 403 | [ ] |

## Phase 0 - Environment (do before Hour 0)

- [x] WSL2 + Ubuntu installed
- [x] Docker Desktop installed; engine running; `docker run hello-world` works
- [x] JDK 17 installed (not on PATH; default is 25, so JAVA_HOME is set per build command)
- [x] Maven 3.10.2 (builds verified with JAVA_HOME=JDK 17)
- [x] Git
- [x] kubectl + Minikube installed; `minikube start --driver=docker --cpus=4 --memory=4096`; `kubectl get nodes` is `Ready`
- [ ] IntelliJ IDEA (or VS Code with Java extensions) and Postman
- [x] Project folder `C:\dev\resqnet-lite`, `git init`, `k8s/`, `docs/`, `postman/` created
- [x] Copy the 9 documents into the repo (`AGENTS.md` at root, others in `docs/`)
- [x] Five Spring Boot projects generated from start.spring.io (Java 17, Maven) and each `mvn clean compile` succeeds
- [ ] Images pre-pulled: `postgres:16`, `rabbitmq:3-management`, `eclipse-temurin:17-jre`

## Phase 1 - Foundation (Hours 0-4)

- [x] `docker-compose.yml`: Postgres (4 databases/users via init script) + RabbitMQ; `docker compose up -d` works
- [x] **auth-service**: User entity, register, login (BCrypt), JWT issuing, `/auth/me`, admin seed
- [x] **auth-service** verified with curl/PowerShell (Postman collection comes in Phase 5) (register, login, duplicate user, wrong password)
- [x] **api-gateway**: Java `RouteLocator` with 4 routes (`StripPrefix=1`)
- [x] **api-gateway**: `JwtAuthenticationFilter` (public paths, strip headers, validate, add `X-User-*`, 401 JSON)
- [x] Gateway test: no token -> 401; valid token -> reaches auth-service `/auth/me`
- [x] Actuator health + probes enabled in all services

## Phase 2 - Core dispatch (Hours 4-8)

- [x] **responder-service**: entity, repository, seed 9 responders
- [x] **responder-service**: `GET /responders`, `GET /responders/{id}`
- [x] **responder-service**: `POST /internal/responders/assign` (row lock, idempotent) and `/release`
- [x] Test: two concurrent assigns never return the same responder
- [x] **incident-service**: entity, repository, DTOs, validation, global exception handler
- [x] **incident-service**: `POST /incidents` (save REPORTED -> call assign -> ASSIGNED)
- [x] **incident-service**: RestClient with timeouts + Resilience4j circuit breaker + fallback to `PENDING`
- [x] **incident-service**: `GET /incidents`, `GET /incidents/{id}` (owner/admin rules)
- [x] **incident-service**: `POST /incidents/{id}/dispatch` and `/resolve` (admin)
- [x] End-to-end through the gateway: report incident -> `ASSIGNED`; stop responder-service locally -> `PENDING`

## Phase 3 - Async events (Hours 8-10)

- [x] RabbitMQ declarables (exchange, queue, binding) in both services
- [x] **incident-service**: publish `incident.assigned` and `incident.pending` (JSON)
- [x] **notification-service**: entity, listener, idempotent save (`event_id` unique)
- [x] **notification-service**: `GET /notifications`, `PATCH /notifications/{id}/read`
- [x] End-to-end: report incident -> notification appears for that user

## Phase 4 - Kubernetes on Minikube (Hours 10-14)  (start early if possible!)

- [x] Dockerfile in each of the 5 services; jars built
- [x] Images built inside Minikube (`minikube docker-env`): 5 images tagged `resqnet/<service>:1.0`
- [x] `00-namespace.yaml`, `01-secrets.yaml`, `02-config.yaml`
- [x] `10-postgres.yaml` (PVC + init script) - pod Ready, 4 databases exist
- [x] `11-rabbitmq.yaml` - pod Ready, queue visible
- [x] `20..23` service manifests (Deployment + ClusterIP + probes + resources)
- [x] `30-gateway.yaml` (NodePort 30080) and `kubectl port-forward` to `localhost:8080` works
- [x] All pods `1/1 Running`
- [x] Full flow works inside the cluster (register -> login -> report -> notification)
- [x] Resilience: `kubectl scale deploy/responder-service --replicas=0` -> `PENDING`, others answer; scale back to 1 -> dispatch works
- [x] Postgres check: `kubectl exec` -> `\l` shows 4 databases

## Phase 5 - Demo readiness (Hours 14-16)

- [ ] Postman collection finished with tests; exported to `postman/`
- [ ] Demo script rehearsed twice from a clean cluster (`kubectl delete ns resqnet` then re-apply)
- [ ] Backup: screenshots or a short screen recording of a successful run
- [ ] Architecture slide (diagram from `docs/Architecture.md`)
- [ ] Teacher Q&A table in `docs/Architecture.md` section 15 read through
- [ ] Laptop prepared: charged, Docker Desktop and Minikube already started, other apps closed

## Stretch (only if every MVP item above is done)

- [ ] `POST/PATCH /responders` admin endpoints
- [ ] Scheduler: auto-retry `PENDING` incidents every 30 s
- [ ] Static demo page (see `docs/ui.md`)
- [ ] 2 replicas of incident-service and gateway (show load balancing)
- [ ] NetworkPolicy restricting `responder-service` to incident-service
- [ ] Dead-letter queue for bad messages

## Risks

| Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|
| Docker/WSL start-up problems | Medium | High | Update WSL, enable virtualization, restart | open |
| Minikube out of memory | Medium | High | 4 GB cluster, JVM caps, close other apps | open |
| Image pull errors in Minikube | High | High | `minikube docker-env`, `IfNotPresent` | open |
| Gateway config differences by Spring Cloud version | Medium | Medium | Java `RouteLocator`, use start.spring.io generated BOM | open |
| Circuit breaker not triggering in demo | Low | High | 2 s timeout, fallback on any exception, rehearse | open |
| Running out of time | Medium | High | Follow phase order; skip stretch; keep services tiny | open |

## Decisions log

| Date | Decision | Reason |
|---|---|---|
| 25 Nov 2026 | Project = ResQNet Lite (emergency dispatch) | Strong distributed story; fits rubric exactly |
| 25 Nov 2026 | Postman as primary client; UI optional | Rubric does not grade UI; saves time |
| 25 Nov 2026 | One Postgres server, four databases/users | Saves RAM; still database-per-service |
| 25 Nov 2026 | RabbitMQ (not Kafka); RestClient + Resilience4j (not Feign/Eureka) | Simplicity |
| 25 Nov 2026 | JWT validated at gateway; identity via headers | Satisfies "authentication at gateway" |
| 25 Nov 2026 | Spring Boot 3.5.16 + Spring Cloud 2025.0.3; poms hand-written | start.spring.io only offers Boot 4.x now; gateway artifact is spring-cloud-starter-gateway-server-webflux |
| 25 Nov 2026 | Images loaded with `minikube image load`, not docker-env | Minikube runtime is containerd; docker-env fails (user approved) |
| 25 Nov 2026 | Docs copied to docs/, AGENTS.md to repo root; Documents/ kept | Docs reference docs/ paths |
| 25 Nov 2026 | Compose maps Postgres to host port 5433 | Host port 5432 used by a local Windows Postgres |
| 25 Nov 2026 | Builds run with JAVA_HOME set to JDK 17 per command | Default java on PATH is 25 |
| 25 Nov 2026 | Business services set JVM default timezone to UTC in main() | JVM zone "Asia/Calcutta" is rejected by PostgreSQL; also satisfies R-CD-8 |
| 25 Nov 2026 | Gateway sets `X-Gateway-Prefix: /api`; service errors use it for `path` | Contract shows public paths in error bodies; X-Forwarded-Prefix is overwritten by the gateway's own filter |
| 25 Nov 2026 | Added `assigned_responder_type` column to incidents (docs/schema.md) | API contract shows responder type in the Incident object; contract outranks schema |
| 25 Nov 2026 | Spring Cloud BOM only in api-gateway; Resilience4j 2.3.0 in incident-service | Cloud BOM pins resilience4j-spring6 to 2.2.0, which broke start-up with resilience4j-spring-boot3 2.3/2.4 |
| 25 Nov 2026 | No retry on assign; RestClient timeouts + circuit breaker only | Keeps fallback fast (R-RS-5 allows at most one retry); assign stays idempotent |
| 25 Nov 2026 | responder-service adds schema.sql (CHECK + partial unique index) run after Hibernate | ddl-auto cannot express them; they are the DB-level guarantee of one responder per incident |
| 25 Nov 2026 | App Deployments use an initContainer (postgres:16, pg_isready) before starting | Without it the apps crashed 3x while Postgres ran its init script, causing RESTARTS > 0 |
| 25 Nov 2026 | scripts/deploy-minikube.ps1 builds with Docker Desktop and uses `minikube image load`; $ErrorActionPreference=Continue | containerd runtime; PS 5.1 aborts on native stderr under Stop |
| 25 Nov 2026 | Readiness = database only (no RabbitMQ) in incident and notification services | A broker outage must not make incident-service unready (R-MQ-4: incident still saved, 201); a stricter reading of R-RS-4 would take it out of the Service |
| 25 Nov 2026 | Failed messages are dropped (default-requeue-rejected=false), no dead-letter queue yet | Avoids an endless redelivery loop on a bad message; DLQ is a stretch item |
| 25 Nov 2026 | Dispatch publishes incident.assigned only when it succeeds; a failed retry publishes nothing | Avoids repeating the "waiting for a responder" notification |

## Work log

| Date/time | Who | What | Result |
|---|---|---|---|
| 25 Nov 2026 | me + Claude | Chose project; wrote the 9 project documents | Done |
| 25 Nov 2026 | me | Installed WSL2 + Ubuntu | OK |
| 25 Nov 2026 | me | Docker Desktop installed; engine running | OK |
| 25 Nov 2026 | Claude | Preflight; 5 Maven skeletons; `mvn clean compile` passes on JDK 17 for all 5 | Done |
| 25 Nov 2026 | Claude | Phase 1: compose (Postgres 4 DBs + RabbitMQ), auth-service, gateway routes + JWT filter. auth 5/5 tests, gateway 12/12 tests; live checks through gateway: 401 no/garbage/wrong-secret token, 201/409/400 register, 401 login, /me, forged header ignored, /internal 404, unrouted-service 503 | Done |
| 25 Nov 2026 | Claude | Phase 2: responder-service (atomic assign/release), incident-service (create/list/get/dispatch/resolve, RestClient + circuit breaker + PENDING fallback). Tests: responder 4/4 (10 concurrent assigns -> exactly 3 ambulances, mutation check: test fails without SKIP LOCKED), incident 13/13 (409, refused, 3 s hang, 500, breaker OPEN stops calls). Live via gateway: ASSIGNED, 4th ambulance PENDING, responder killed -> PENDING in ~45 ms, /api/responders 503, login/list still fine, restart + dispatch -> ASSIGNED; DB: incident_user cannot connect to auth_db | Done |
| 25 Nov 2026 | Claude | Walking skeleton: Dockerfiles, k8s 00-22 + 30, scripts/deploy-minikube.ps1. Fresh namespace -> 6 pods 1/1, 0 restarts. Via port-forward: 401 no token, register/login, MEDICAL ASSIGNED, USER dispatch 403; scale responder to 0 -> PENDING (~1 s first call, then ~40 ms), /api/responders 503, login + list OK; scale to 1 -> dispatch ASSIGNED; deleted Postgres pod -> data kept (3 incidents before/after), auth readiness dipped to 0/1 then recovered. `\l` in the postgres pod shows the 4 databases | Done |
| 25 Nov 2026 | Claude | Phase 3: incident-service publishes events (19/19 tests), notification-service built (9/9 tests, incl. 8 concurrent copies of one event -> 1 row, malformed -> rejected). Local run with RabbitMQ: notification appears, duplicate eventId ignored, malformed dropped, notifications-down -> events wait then delivered | Done |
| 25 Nov 2026 | Claude | Phase 4 in Minikube (fresh namespace, full deploy script, exit 0): 7 pods 1/1, 0 restarts. ASSIGNED + notification; duplicate event -> 1 notification; malformed x2 -> queue 0; notification-service scaled to 0 -> rabbitmqctl shows 2 messages / 0 consumers, GET /api/notifications 503, after scale 1 -> 4 notifications, queue 0; responder down -> PENDING + pending notification, dispatch -> assigned notification; RabbitMQ down -> incident still 201 in 58 ms (event lost, trade-off D7); deleted incident/auth/notification/responder/gateway pods -> all recreated, data kept, old JWT still valid; auth checklist 10 cases + 9 extra = 19/19 PASS; only api-gateway is NodePort, all else ClusterIP | Done |

## Command cheat sheet (demo day)

```powershell
minikube start --driver=docker --cpus=4 --memory=4096
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
kubectl -n resqnet get pods
kubectl -n resqnet port-forward svc/api-gateway 8080:8080
kubectl -n resqnet scale deploy/responder-service --replicas=0
kubectl -n resqnet scale deploy/responder-service --replicas=1
kubectl -n resqnet logs deploy/incident-service --tail=50
kubectl -n resqnet exec deploy/postgres -- psql -U postgres -c "\l"
```

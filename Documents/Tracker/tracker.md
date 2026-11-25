# Tracker - ResQNet Lite

Live status board. Update it after every task (tick the box, add a line to the log).
Legend: `[ ]` not started, `[~]` in progress, `[x]` done, `[!]` blocked.

**Deadline:** presentation about 16 hours after the plan was made (25 Nov 2026). Hours below are working hours counted from the start of Phase 1; Phase 0 is the environment setup done first.

## Current status

| Item | Value |
|---|---|
| Phase | 0 - Environment setup |
| Next action | Start Docker Desktop and confirm `docker run hello-world` works |
| Blockers | Docker engine was not running when last checked |
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
- [~] Docker Desktop installed; engine running; `docker run hello-world` works
- [ ] JDK 17 (`java -version` shows 17)
- [ ] Maven (`mvn -version` shows Java 17)
- [ ] Git
- [ ] kubectl + Minikube installed; `minikube start --driver=docker --cpus=4 --memory=4096`; `kubectl get nodes` is `Ready`
- [ ] IntelliJ IDEA (or VS Code with Java extensions) and Postman
- [ ] Project folder `C:\dev\resqnet-lite`, `git init`, `k8s/`, `docs/`, `postman/` created
- [ ] Copy the 9 documents into the repo (`AGENTS.md` at root, others in `docs/`)
- [ ] Five Spring Boot projects generated from start.spring.io (Java 17, Maven) and each `mvn clean compile` succeeds
- [ ] Images pre-pulled: `postgres:16`, `rabbitmq:3-management`, `eclipse-temurin:17-jre`

## Phase 1 - Foundation (Hours 0-4)

- [ ] `docker-compose.yml`: Postgres (4 databases/users via init script) + RabbitMQ; `docker compose up -d` works
- [ ] **auth-service**: User entity, register, login (BCrypt), JWT issuing, `/auth/me`, admin seed
- [ ] **auth-service** verified with Postman (register, login, duplicate user, wrong password)
- [ ] **api-gateway**: Java `RouteLocator` with 4 routes (`StripPrefix=1`)
- [ ] **api-gateway**: `JwtAuthenticationFilter` (public paths, strip headers, validate, add `X-User-*`, 401 JSON)
- [ ] Gateway test: no token -> 401; valid token -> reaches auth-service `/auth/me`
- [ ] Actuator health + probes enabled in all services

## Phase 2 - Core dispatch (Hours 4-8)

- [ ] **responder-service**: entity, repository, seed 9 responders
- [ ] **responder-service**: `GET /responders`, `GET /responders/{id}`
- [ ] **responder-service**: `POST /internal/responders/assign` (row lock, idempotent) and `/release`
- [ ] Test: two concurrent assigns never return the same responder
- [ ] **incident-service**: entity, repository, DTOs, validation, global exception handler
- [ ] **incident-service**: `POST /incidents` (save REPORTED -> call assign -> ASSIGNED)
- [ ] **incident-service**: RestClient with timeouts + Resilience4j circuit breaker + fallback to `PENDING`
- [ ] **incident-service**: `GET /incidents`, `GET /incidents/{id}` (owner/admin rules)
- [ ] **incident-service**: `POST /incidents/{id}/dispatch` and `/resolve` (admin)
- [ ] End-to-end through the gateway: report incident -> `ASSIGNED`; stop responder-service locally -> `PENDING`

## Phase 3 - Async events (Hours 8-10)

- [ ] RabbitMQ declarables (exchange, queue, binding) in both services
- [ ] **incident-service**: publish `incident.assigned` and `incident.pending` (JSON)
- [ ] **notification-service**: entity, listener, idempotent save (`event_id` unique)
- [ ] **notification-service**: `GET /notifications`, `PATCH /notifications/{id}/read`
- [ ] End-to-end: report incident -> notification appears for that user

## Phase 4 - Kubernetes on Minikube (Hours 10-14)  (start early if possible!)

- [ ] Dockerfile in each of the 5 services; jars built
- [ ] Images built inside Minikube (`minikube docker-env`): 5 images tagged `resqnet/<service>:1.0`
- [ ] `00-namespace.yaml`, `01-secrets.yaml`, `02-config.yaml`
- [ ] `10-postgres.yaml` (PVC + init script) - pod Ready, 4 databases exist
- [ ] `11-rabbitmq.yaml` - pod Ready, queue visible
- [ ] `20..23` service manifests (Deployment + ClusterIP + probes + resources)
- [ ] `30-gateway.yaml` (NodePort 30080) and `kubectl port-forward` to `localhost:8080` works
- [ ] All pods `1/1 Running`
- [ ] Full flow works inside the cluster (register -> login -> report -> notification)
- [ ] Resilience: `kubectl scale deploy/responder-service --replicas=0` -> `PENDING`, others answer; scale back to 1 -> dispatch works
- [ ] Postgres check: `kubectl exec` -> `\l` shows 4 databases

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

## Work log

| Date/time | Who | What | Result |
|---|---|---|---|
| 25 Nov 2026 | me + Claude | Chose project; wrote the 9 project documents | Done |
| 25 Nov 2026 | me | Installed WSL2 + Ubuntu | OK |
| 25 Nov 2026 | me | Docker Desktop installed; engine not yet running | Fixing |

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

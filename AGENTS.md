# AGENTS.md - ResQNet Lite

Operating guide for AI coding agents (and humans) working in this repository.
Read this file first, then the docs listed below. Keep changes small and verifiable.

## 1. What this project is

**ResQNet Lite** is a microservices-based emergency dispatch platform for a college
Microservices Lab (Spring Boot + Kubernetes/Minikube). A user reports an incident, the
system assigns an available responder, and a notification is produced. If the responder
service is down, incidents are still accepted as `PENDING`.

The project is graded on a **20-mark rubric**. Every decision should serve it:

| Criterion | Marks | Minimum evidence |
|---|---|---|
| Deployment | 5 | Services deployed on Minikube |
| Database | 4 | Each service has its own database |
| Cross-service communication | 4 | One synchronous call + one asynchronous event |
| Resilience | 4 | One service goes down while others still answer |
| Security | 3 | Authentication checked at the gateway |

If a task does not help one of these rows or the demo, do not do it.

## 2. Read these first (source-of-truth order)

When documents disagree, the higher one wins:

1. `docs/API_CONTRACT.md` - exact endpoints, payloads, status codes, event schema
2. `docs/schema.md` - tables, enums, state machines
3. `docs/AUTHENTICATION.md` - JWT format, gateway filter, header contract, role matrix
4. `docs/Architecture.md` - services, ports, communication, deployment
5. `docs/rules.md` - normative MUST / MUST NOT rules
6. `docs/PRD.md` - scope and acceptance criteria
7. `docs/ui.md` - demo client (Postman first, optional static page)
8. `docs/tracker.md` - current status; update it after every task

## 3. Repository layout

```text
resqnet-lite/
  AGENTS.md
  docs/                    PRD.md Architecture.md schema.md API_CONTRACT.md
                           AUTHENTICATION.md ui.md rules.md tracker.md
  api-gateway/             Spring Cloud Gateway (reactive), JWT filter, port 8080
  auth-service/            register/login, issues JWT, port 8081, auth_db
  incident-service/        incidents, sync call + event publisher, port 8082, incident_db
  responder-service/       responders, atomic assignment, port 8083, responder_db
  notification-service/    consumes events, stores notifications, port 8084, notification_db
  k8s/                     all Kubernetes manifests (namespace: resqnet)
  postman/                 ResQNet-Lite.postman_collection.json
  docker-compose.yml       local Postgres + RabbitMQ
```

Package base: `com.resqnet.<service>` (for example `com.resqnet.incident`).
Sub-packages: `controller`, `service`, `repository`, `model`, `dto`, `config`,
`client`, `messaging`, `exception`.

## 4. Tech stack (do not change without asking)

- Java 17, Maven, Spring Boot 3.x (latest stable 3.x chosen at project generation)
- Spring Cloud release train that matches the chosen Boot version
- Spring Cloud Gateway (reactive) for the gateway only
- Spring Web + Spring Data JPA + PostgreSQL 16 in the four business services
- Spring AMQP + RabbitMQ 3 (management image) for events
- Resilience4j (circuit breaker, time limit) in `incident-service`
- jjwt 0.12.x for JWT; BCrypt for password hashing
- Docker, Kubernetes on Minikube (docker driver), Windows 11 + PowerShell for dev

## 5. Commands (Windows PowerShell)

```powershell
# Local infrastructure (Postgres with 4 databases + RabbitMQ)
docker compose up -d
docker compose down

# Build one service (skip tests for quick image builds)
cd auth-service
mvn -q clean package -DskipTests

# Run one service locally with the local profile
mvn spring-boot:run "-Dspring-boot.run.profiles=local"

# Run tests
mvn test

# Minikube
minikube start --driver=docker --cpus=4 --memory=4096
& minikube -p minikube docker-env --shell powershell | Invoke-Expression   # per terminal window
docker build -t resqnet/auth-service:1.0 ./auth-service
kubectl apply -f k8s/
kubectl -n resqnet get pods
kubectl -n resqnet logs deploy/incident-service --tail=100
kubectl -n resqnet port-forward svc/api-gateway 8080:8080

# Resilience demo
kubectl -n resqnet scale deploy/responder-service --replicas=0
kubectl -n resqnet scale deploy/responder-service --replicas=1
```

Use `curl.exe` (not `curl`, which is a PowerShell alias) or, preferably, the Postman collection.
For JSON bodies in PowerShell, use `-d "@body.json"` instead of inline quotes.

## 6. Conventions (summary - full list in `docs/rules.md`)

- Services are independent: **no shared database, no shared entity classes, no shared library**
  that couples services. Each service owns its DTOs.
- All client traffic enters through the gateway under `/api/**`. Internal endpoints live
  under `/internal/**` and are **never** routed by the gateway.
- Configuration comes from environment variables with local defaults in `application.yml`.
  Secrets (JWT secret, DB passwords) are never hard-coded in manifests committed for real use.
- Every service exposes `/actuator/health` with liveness and readiness probes enabled.
- Error responses use the standard JSON error body defined in `docs/API_CONTRACT.md`.
- Controllers stay thin; business logic lives in `service` classes; no entities in API responses.

## 7. Boundaries

**Always**
- Update `docs/tracker.md` when a task is finished (check the box, add a log line).
- Keep code, API contract and schema consistent; change the doc in the same commit as the code.
- Run the service and exercise the endpoint before declaring it done.
- Keep each service buildable on its own (`mvn clean package` inside its folder).

**Ask first**
- Adding a new service, database, dependency, or infrastructure component.
- Changing an endpoint, event payload, table, port or role rule.
- Anything on the cut list in `docs/rules.md` (Redis, WebSockets, Prometheus/Grafana, autoscaling, Kafka).

**Never**
- Let one service read another service's database.
- Trust `X-User-*` headers that came from outside the gateway (the gateway strips and re-sets them).
- Expose `/internal/**` through the gateway, a NodePort, or an Ingress.
- Commit real secrets, `target/` folders, IDE files or `.env` files.
- Disable authentication to "make a test pass".

## 8. Task workflow

1. Pick the next unchecked item in `docs/tracker.md` (respect phase order).
2. Re-read the relevant contract/schema sections.
3. Implement the smallest change that satisfies the acceptance criteria in `docs/PRD.md`.
4. Verify locally (build + call the endpoint). For Kubernetes tasks, verify with `kubectl get pods`
   and a request through the gateway.
5. Update docs if behaviour changed, tick the tracker, then commit with a clear message
   (`feat(incident): create incident with responder assignment`).

## 9. Definition of done

- Code compiles; the service starts; the endpoint behaves exactly as in `API_CONTRACT.md`.
- Auth behaviour matches the role matrix in `AUTHENTICATION.md`.
- No cross-database access; no hard-coded hostnames (use env vars / Kubernetes service names).
- Health endpoint is `UP` and the pod becomes `Ready` in Kubernetes (for deployed items).
- Tracker updated.

## 10. Known pitfalls

- **Gateway routes:** define routes in a Java `RouteLocator` bean. Spring Cloud Gateway property
  prefixes changed in recent release trains, so Java config avoids version surprises.
- **Gateway is reactive:** do not add `spring-boot-starter-web` to `api-gateway`.
- **auth-service security:** if `spring-boot-starter-security` is on the classpath it locks every
  endpoint by default. Prefer the `spring-security-crypto` dependency (BCrypt only), or add a
  `SecurityFilterChain` that permits all (the gateway is the guard).
- **Minikube images:** build images in a terminal where `minikube docker-env` was applied, and set
  `imagePullPolicy: IfNotPresent`, otherwise pods show `ErrImagePull`.
- **NodePort on Windows + docker driver** is not directly reachable; use
  `kubectl port-forward` or `minikube service api-gateway -n resqnet --url`.
- **Assignment race:** responder assignment must use a row lock (`FOR UPDATE SKIP LOCKED`) or an
  equivalent atomic update; never read-then-write without locking.
- **Do not call remote services inside a DB transaction** in `incident-service`; save, commit, then call.

# ResQNet Lite - Viva Script

How to use this file: read sections A to C once, practise the demo (section B) twice with `docs/demo/DEMO_SCRIPT.md`,
then read the questions in section G out loud. Every file, class, method, command and number below exists in the repository;
the exact line numbers are in [`CODE_REFERENCES.md`](CODE_REFERENCES.md) (generated from the source and checked by `scripts/verify-references.ps1`).

---

## A. Introduction (say it in your own words)

### A1. One-minute version

"My project is **ResQNet Lite**, an emergency dispatch system built as **six Spring Boot microservices** and deployed on
**Kubernetes (Minikube)**. A user reports an emergency, for example a medical case. The system saves it, asks a separate
**responder service** for a free ambulance, assigns it, and a **notification service** records a notification.
The important idea: if the responder service is down, the incident is **still accepted** with status `PENDING` and can be
dispatched later, so one failing service does not stop the whole system. Every request goes through one **API gateway**
that checks a **JWT token**. Each service has its **own database**, services find each other through **Eureka**, and the
system shows **one synchronous call** (REST) and **one asynchronous event** (RabbitMQ)."

### A2. Three-minute version (add these points)

1. **Problem:** in a monolith, one failure stops everything. Dispatching needs several independent jobs (login, recording incidents, finding responders, notifying), so I split them into services that can fail and scale independently.
2. **Services:** `api-gateway` (8080, two copies), `auth-service` (8081), `incident-service` (8082, two copies), `responder-service` (8083), `notification-service` (8084), `discovery-service` (Eureka, 8761), plus PostgreSQL and RabbitMQ.
3. **Communication:** the incident service calls the responder service **synchronously** because the reporter needs the answer (`ASSIGNED` or `PENDING`) immediately. It sends a notification **asynchronously** through RabbitMQ because a notification is a side effect that must never slow down or break dispatch.
4. **Resilience:** timeouts, a **circuit breaker** and a **fallback** turn "responder is down" into a `PENDING` incident. The gateway also **retries GET requests** on another copy when one copy dies.
5. **Security:** the JWT is checked **only at the gateway**. Services trust the identity headers the gateway adds, and only the gateway is reachable from outside the cluster.
6. **Proof:** 51 automated JUnit tests, plus scripts that run the whole demo from a clean cluster (smoke test, resilience demo, failover demo, load test, Postman collection). They passed on a freshly deployed cluster with no pod restarts.

### A3. Why this project / why microservices / main features

- **Why this project:** it shows every lab requirement naturally (database per service, sync + async communication, resilience, gateway security, discovery, load balancing) with a story anyone understands.
- **Why microservices:** independent failure (responder outage must not stop login or reporting), independent scaling (two copies of the incident service), and each team/service owns its data.
- **Main features:** register/login, report incident with automatic responder assignment, `PENDING` fallback, admin dispatch and resolve, per-user notifications, role-based access (USER vs ADMIN), load balancing and failover.

---

## B. Demonstration (what to type, what you will see)

Start state: `kubectl -n resqnet get pods` shows 10 pods `1/1 Running`. The timed 5-minute version is in
[`docs/demo/DEMO_SCRIPT.md`](../demo/DEMO_SCRIPT.md). The short version with expected results:

| Step | Command / action | Expected result | What to say |
|---|---|---|---|
| 1 | `kubectl -n resqnet get pods` | 10 pods, all `1/1 Running` (two `api-gateway`, two `incident-service`) | "Everything runs in one namespace on Minikube." |
| 2 | `kubectl -n resqnet port-forward svc/api-gateway 8080:8080` (keep open) | `Forwarding from 127.0.0.1:8080` | "Only the gateway is exposed; I tunnel to it." |
| 3 | `GET http://localhost:8080/api/incidents` with no token | **401** `UNAUTHORIZED` | "Authentication is checked at the gateway. The request never reached a service." |
| 4 | Register `asha` / `Pass@1234`, then login | 201, then 200 with a token | "BCrypt password, JWT signed with a shared secret." |
| 5 | `POST /api/incidents` MEDICAL / CRITICAL | **201**, `ASSIGNED`, "Ambulance Alpha" | "Synchronous call to the responder service, row lock, no double assignment." |
| 6 | `GET /api/notifications` | one "assigned to Ambulance Alpha" notification | "That came through RabbitMQ, asynchronously." |
| 7 | `kubectl -n resqnet scale deploy/responder-service --replicas=0` | pod terminates | "I simulate the responder service crashing." |
| 8 | Report another incident | **201**, `PENDING`, answer in well under 3 s | "Timeout plus circuit breaker plus fallback. The incident is not lost." |
| 9 | `GET /api/responders` ; login ; `GET /api/notifications` | **503** ; **200** ; **200** | "Only the dead service's own endpoint fails; everything else answers." |
| 10 | `kubectl -n resqnet scale deploy/responder-service --replicas=1` and wait until Ready | pod `1/1` | "Kubernetes starts it again." |
| 11 | Login as `admin` / `Admin@123`, `POST /api/incidents/{id}/dispatch` | **200**, `ASSIGNED` | "The admin retries and the incident is assigned." |
| 12 | `kubectl -n resqnet exec deploy/postgres -- psql -U postgres -c "\l"` | `auth_db`, `incident_db`, `responder_db`, `notification_db` | "Four databases, four users, no sharing." |

Optional extras: Eureka dashboard (`kubectl -n resqnet port-forward svc/discovery-service 8761:8761`, open `http://localhost:8761`),
RabbitMQ UI (`kubectl -n resqnet port-forward svc/rabbitmq 15672:15672`, user `resqnet`, password `rabbit-demo`),
`.\scripts\demo-failover.ps1` (delete a pod under traffic), `.\scripts\load-test.ps1` (20 users at once).

---

## C. Walkthrough of the key files

Package base: `com.resqnet.<service>`. Layers: `controller` (HTTP only) -> `service` (business logic) -> `repository` (data); DTOs are Java records; one `GlobalExceptionHandler` per service produces the standard JSON error body.

### api-gateway  (rubric: Security, Service discovery and gateway, Handles traffic)

| File | Purpose | Important parts |
|---|---|---|
| `api-gateway/src/main/java/com/resqnet/gateway/security/JwtAuthenticationFilter.java` | The security control of the whole system | `GlobalFilter` with `Ordered.HIGHEST_PRECEDENCE`; strips `X-User-*`; `Jwts.parser().verifyWith(key)`; adds trusted headers; writes the 401 JSON itself |
| `api-gateway/src/main/java/com/resqnet/gateway/config/GatewayRoutes.java` | Routing table | `RouteLocator` bean; `lb://incident-service` (Eureka + load balancer); `stripPrefix(1)`; GET `retry`; no route for `/internal/**` |
| `api-gateway/src/main/java/com/resqnet/gateway/config/GatewayErrorHandler.java` | Standard error body for gateway failures | dead service -> 503 `SERVICE_UNAVAILABLE`; unknown path -> 404 |
| `api-gateway/src/main/resources/application.yml` | Settings | JWT secret/issuer from env, Eureka client, `connect-timeout: 1000`, `response-timeout: 8s` |

### auth-service  (Security, Database)

| File | Purpose | Important parts |
|---|---|---|
| `auth-service/src/main/java/com/resqnet/auth/service/AuthService.java` | Register and login | `@Transactional`; BCrypt `matches`; role always `USER`; same error for unknown user and wrong password |
| `auth-service/src/main/java/com/resqnet/auth/service/JwtService.java` | Creates the token | HS256, claims `sub`, `username`, `role`, `exp`; refuses a secret shorter than 32 characters |
| `auth-service/src/main/java/com/resqnet/auth/config/AdminSeeder.java` | Creates `admin` / `Admin@123` if missing | `ApplicationRunner` |
| `auth-service/src/main/java/com/resqnet/auth/controller/AuthController.java` | `/auth/register`, `/auth/login`, `/auth/me` | `@RestController`, `@Valid`; `/me` reads the gateway headers |

### incident-service  (Cross-service communication, Resilience, Handles traffic)

| File | Purpose | Important parts |
|---|---|---|
| `incident-service/src/main/java/com/resqnet/incident/client/ResponderClient.java` | The one synchronous call | `@CircuitBreaker(name = "responderService", fallbackMethod = ...)`; 409 handled as "none free" |
| `incident-service/src/main/java/com/resqnet/incident/service/IncidentService.java` | Incident lifecycle | save -> remote call -> save (no remote call inside a DB transaction); `create`, `dispatch`, `resolve`, `tryAssign` |
| `incident-service/src/main/java/com/resqnet/incident/config/RestClientConfig.java` | HTTP client | `@LoadBalanced` (find `responder-service` by name); connect 1 s / read 2 s timeouts |
| `incident-service/src/main/java/com/resqnet/incident/messaging/IncidentEventPublisher.java` | Publishes events | `RabbitTemplate.convertAndSend`; a failed publish never fails the request |
| `incident-service/src/main/java/com/resqnet/incident/messaging/RabbitConfig.java` | Exchange, queue, binding | `TopicExchange resqnet.events`, queue `notification.incidents`, binding `incident.*`, JSON converter |
| `incident-service/src/main/java/com/resqnet/incident/security/CurrentUser.java` | Who is calling | reads `X-User-*` only; `requireAdmin()`, `requireOwnerOrAdmin()` |
| `incident-service/src/main/resources/application.yml` | Settings | `resilience4j.circuitbreaker.instances.responderService` (window 5, min 3 calls, 50 %, 10 s open, 2 half-open) |

### responder-service  (Database, Cross-service communication)

| File | Purpose | Important parts |
|---|---|---|
| `responder-service/src/main/java/com/resqnet/responder/repository/ResponderRepository.java` | The atomic assignment query | native SQL `FOR UPDATE SKIP LOCKED` |
| `responder-service/src/main/java/com/resqnet/responder/service/ResponderService.java` | `assign`, `release` | `@Transactional`; idempotent per `incidentId`; 409 `NO_RESPONDER_AVAILABLE` |
| `responder-service/src/main/resources/schema.sql` | Database guards | CHECK (BUSY exactly when it holds an incident); unique index on `current_incident_id` |
| `responder-service/src/main/java/com/resqnet/responder/controller/InternalResponderController.java` | `/internal/responders/**` | not routed by the gateway |

### notification-service  (Cross-service communication, Database)

| File | Purpose | Important parts |
|---|---|---|
| `notification-service/src/main/java/com/resqnet/notification/messaging/IncidentEventListener.java` | Receives events | `@RabbitListener(queues = ...)` |
| `notification-service/src/main/java/com/resqnet/notification/service/NotificationService.java` | Stores notifications | `existsByEventId` + unique constraint (idempotent); malformed -> `AmqpRejectAndDontRequeueException` |
| `notification-service/src/main/java/com/resqnet/notification/model/Notification.java` | The table | `event_id` UNIQUE |
| `notification-service/src/main/java/com/resqnet/notification/messaging/RabbitConfig.java` | Same topology + converter | `TypePrecedence.INFERRED` (ignore the sender's class name) |

### discovery-service, Docker, Kubernetes, scripts  (Service discovery, Deployed)

| File | Purpose |
|---|---|
| `discovery-service/src/main/java/com/resqnet/discovery/DiscoveryServiceApplication.java` | `@EnableEurekaServer`, the registry |
| `*/Dockerfile` | `eclipse-temurin:17-jre` + the Maven jar |
| `k8s/00-namespace.yaml` ... `k8s/30-gateway.yaml` | Namespace, Secret, ConfigMap, Postgres (PVC), RabbitMQ, Eureka, five app Deployments, gateway NodePort |
| `db/init-databases.sh` | Creates the 4 databases and 4 users, `REVOKE CONNECT ... FROM PUBLIC` |
| `scripts/deploy-minikube.ps1` | Build jars, build images, `minikube image load`, `kubectl apply`, wait for Ready |
| `scripts/rehearsal.ps1` | Clean cluster -> deploy -> all checks, with a summary table |

---

## D. Exact source-code references

See [`CODE_REFERENCES.md`](CODE_REFERENCES.md): 43 references (file, **exact line**, snippet, class and method, rubric row), generated from the source with
`.\scripts\generate-references.ps1` and checked with `.\scripts\verify-references.ps1`. If you change code, run both again. When asked "where is X?", open the file and point at the line.

---

## E. Request flows (explain with the diagrams in `docs/diagrams/`)

**Happy path** (`02-report-incident-sequence.png`)
1. The client calls `POST /api/incidents` with a Bearer token.
2. The gateway verifies the token, removes any client-sent `X-User-*` headers, adds verified ones, and routes to a running `incident-service` (chosen through Eureka, round-robin).
3. `IncidentService.create` saves the incident as `REPORTED` and commits.
4. It calls `POST /internal/responders/assign` on responder-service (1 s connect, 2 s read timeout, circuit breaker).
5. `ResponderService.assign` runs in one transaction: it locks one free responder row (`FOR UPDATE SKIP LOCKED`) and sets it `BUSY` with the incident id.
6. incident-service saves `ASSIGNED`, publishes `incident.assigned`, returns **201**.
7. RabbitMQ delivers the event; notification-service stores one notification (skipping a repeated `eventId`).

**Fallback** (`03-fallback-sequence.png`): the call in step 4 fails (refused, timeout, 5xx, or the breaker is already open). `ResponderClient.assignFallback` returns "no responder", the incident is saved as `PENDING`, `incident.pending` is published, and the client still gets **201**. Later an admin calls `POST /api/incidents/{id}/dispatch`.

**Event** (`04-event-flow.png`): incident-service -> exchange `resqnet.events` (topic) -> binding `incident.*` -> queue `notification.incidents` -> `IncidentEventListener` -> `NotificationService.recordEvent`. If notification-service is down, messages wait in the queue and are delivered when it returns.

**Security**: login at auth-service returns a JWT; every other request is checked by `JwtAuthenticationFilter` before any service is called.

**Data** (`05-database-er.png`): four databases on one server; cross-service references (user id, responder id, incident id) are plain numbers, never foreign keys.

---

## F. Docker and Kubernetes in simple words (with the commands to show)

| Term | Simple meaning | Where in this project |
|---|---|---|
| Dockerfile | recipe to build an image | `auth-service/Dockerfile`: Java 17 runtime + the jar |
| Image | frozen package of the app | `resqnet/auth-service:1.0` (built with `docker build`, copied into Minikube with `minikube image load`) |
| Container | a running image | one per pod |
| Pod | smallest unit Kubernetes runs | `kubectl -n resqnet get pods` |
| Deployment | "keep N copies of this pod running" | `k8s/21-incident.yaml` has `replicas: 2` |
| Service | stable name and address in front of pods | `ClusterIP` for everything except the gateway (`NodePort`) |
| ConfigMap / Secret | settings / passwords kept outside the image | `k8s/02-config.yaml`, `k8s/01-secrets.yaml` (DEMO values) |
| PersistentVolumeClaim | disk that survives pod restarts | Postgres data in `k8s/10-postgres.yaml` |
| Probes | health checks | `startupProbe`, `livenessProbe`, `readinessProbe` on `/actuator/health/...` |
| Init container | runs before the app | waits until Postgres (and RabbitMQ) accept connections |
| Ingress | HTTP entry with rules | **not used**; I use a NodePort gateway and `kubectl port-forward` |

Commands to show:

```powershell
kubectl -n resqnet get pods                               # all pods, READY and RESTARTS
kubectl -n resqnet get svc                                # only api-gateway is a NodePort
kubectl -n resqnet logs deploy/incident-service --tail=30 # logs (incident id, FALLBACK used, published ...)
kubectl -n resqnet rollout restart deploy/incident-service   # restart a deployment
kubectl -n resqnet scale deploy/responder-service --replicas=0   # the resilience demo (then --replicas=1)
kubectl -n resqnet delete pod <incident-pod-name>         # Kubernetes recreates it (self-healing)
kubectl -n resqnet describe pod <pod>                     # events, probes, last state
kubectl -n resqnet exec deploy/postgres -- psql -U postgres -c "\l"   # the 4 databases
kubectl delete ns resqnet                                 # wipe everything; then .\scripts\deploy-minikube.ps1
```

---

## G. Likely viva questions (short answers)

**Microservices and design**

1. **Why microservices here?** Independent failure and scaling: a responder outage must not stop login or reporting, and I can run two copies of only the busiest service.
2. **How do you guarantee database-per-service?** Four databases and four users. `db/init-databases.sh` revokes `CONNECT` from `PUBLIC`, so `incident_user` cannot even connect to `auth_db` (I tested it: "permission denied for database"). No service reads another's tables; cross-service references are plain ids.
3. **Why one PostgreSQL server for four databases?** To fit in the laptop's memory. It is still database-per-service; the weakness is that the shared server is one point of failure (listed under improvements).
4. **Synchronous or asynchronous, and why both?** Assignment is synchronous because the reporter needs `ASSIGNED` or `PENDING` in the response. Notification is asynchronous because it is a side effect that must not slow down or break dispatch.
5. **Why RabbitMQ and not Kafka?** Light and simple, enough for one event type. Kafka is better for replay and streaming, which I do not need.
6. **Why no outbox pattern?** Time. The risk: if RabbitMQ is down after the incident is saved, that one event is lost (I measured it: the incident is still accepted, only its notification is missing). The outbox pattern is the named improvement.

**Resilience**

7. **What happens if responder-service dies?** The call fails fast (1 s connect, 2 s read timeout), the circuit breaker counts failures and then opens, and the fallback saves the incident as `PENDING`, publishes `incident.pending` and returns 201. Login, listing and notifications are unaffected. I demonstrate it with `kubectl scale ... --replicas=0`.
8. **Explain the circuit breaker.** `ResponderClient` has `@CircuitBreaker`. Closed: calls go through. After at least 3 calls with 50 % failures in the last 5, it opens for 10 s and calls fail instantly. Then 2 probe calls (half-open); success closes it. The fallback runs whenever the call fails.
9. **Is a 409 "no responder available" a failure for the breaker?** No. It is a normal business answer, so it is handled inside `ResponderClient.assign` and returns "none free", which also gives `PENDING` but does not count against the breaker.
10. **Why do you not retry POST requests?** A repeated "report incident" could create two incidents. Only GET (idempotent) is retried, by the gateway, on another copy.
11. **What happens when a pod dies under traffic?** Before the gateway retry I measured 9 failed requests out of 32 including a 30 s hang; with the retry, 114 of 114 requests returned 200 and the slowest took 1.08 s (`scripts/demo-failover.ps1`).
12. **What if RabbitMQ is down?** `IncidentEventPublisher` catches the failure and logs it at ERROR, the incident is still saved and the client gets 201. That event is lost (trade-off above).
13. **What if notification-service is down?** Events wait in the durable queue and are delivered when it returns (I showed 2 messages waiting and then delivered).

**Concurrency and data**

14. **How do you prevent two incidents getting the same ambulance?** `ResponderRepository.lockFirstAvailable` uses `SELECT ... FOR UPDATE SKIP LOCKED` inside one `@Transactional` method. A second transaction skips the locked row and takes the next free one. A unique index on `current_incident_id` is the last line of defence.
15. **How do you know it works?** `ResponderServiceConcurrencyTest` fires 10 simultaneous assignments for 3 ambulances: exactly 3 succeed with different responders. I also checked the test can fail: with the lock removed it reports "responder handed out twice".
16. **What does idempotent mean here?** Calling assign twice for the same incident returns the same responder; calling release twice is harmless; the notification consumer ignores a repeated `eventId` (quick `existsByEventId` check plus a unique column).
17. **Why save, then call, then save again in incident-service?** Rule: never hold a database transaction open across a network call. A slow responder service must not hold database connections.
18. **Why `ddl-auto=update`?** Fast for the lab. In production I would use Flyway migrations. The extra constraints (CHECK and partial unique index) are added by `schema.sql`.

**Security**

19. **Where is authentication done?** Only at the gateway (`JwtAuthenticationFilter`). Invalid or missing tokens get 401 and never reach a service.
20. **How do services know who the user is?** From `X-User-Id`, `X-User-Name`, `X-User-Role`, set by the gateway after verifying the token. The gateway removes any such headers sent by the client, so a forged `X-User-Role: ADMIN` is ignored (tested).
21. **What if someone calls a service directly?** Services are `ClusterIP`, not reachable from outside the cluster. `/internal/**` has no gateway route (404).
22. **How are passwords and tokens protected?** BCrypt hashes; HS256 JWT with a secret of at least 32 characters (the app refuses to start with a shorter one), expiry 120 minutes. The Kubernetes secrets in the repo are demo values.
23. **Limitations of your security?** No refresh tokens or revocation, no HTTPS inside the cluster, no rate limiting, the same symmetric key in auth-service and the gateway.

**Discovery, load balancing, Kubernetes**

24. **What does Eureka do here?** Every service registers its name and address and sends a heartbeat every 5 s. The gateway (`lb://incident-service`) and incident-service (`@LoadBalanced` client calling `responder-service`) look services up **by name**; Spring Cloud LoadBalancer picks a copy round-robin. A dead copy is removed after missed heartbeats.
25. **Kubernetes already has DNS, so why Eureka?** The lab rubric asks for it. It also gives client-side load balancing across copies and a registry view (dashboard on 8761).
26. **How did you show load balancing?** Two `incident-service` pods; `scripts/load-test.ps1` runs 20 users at once (1,500 requests, all HTTP 200, about 130-150 requests/second) and the `X-Served-By` header shows a 50 % / 50 % split between the two pods.
27. **Why Minikube?** Free, local, a real Kubernetes API. It gives self-healing, readiness probes, service names and easy scale up/down for the demo.
28. **How did the images get into Minikube?** This Minikube uses the containerd runtime, so `minikube docker-env` does not work. `scripts/deploy-minikube.ps1` builds with Docker Desktop and runs `minikube image load`.
29. **What are probes?** Startup (give the JVM time to boot), liveness (restart if dead), readiness (only send traffic when ready; includes the database check). All use `/actuator/health/...`.
30. **How did you test?** 51 JUnit tests (Mockito and real PostgreSQL through Testcontainers) in `auth-service` (5), `api-gateway` (14), `responder-service` (4), `incident-service` (19), `notification-service` (9). On the cluster: `smoke-test.ps1` (37 checks), `demo-resilience.ps1` (16), `demo-failover.ps1` (7), Postman via newman (43 assertions), `load-test.ps1`, all started from a deleted namespace by `scripts/rehearsal.ps1`.
35. **Is it hosted in the cloud?** No. Everything runs on my laptop in Minikube. For the public-URL requirement I use a free Cloudflare quick tunnel (`scripts/start-public-url.ps1`) that gives a temporary `https://....trycloudflare.com` link to the gateway; I ran the full smoke test (37 checks) through that link. The limits: the link changes every time, it works only while the laptop is on, and anyone with the link can use the demo (including the demo admin login), so I open it only during the demo.
36. **What if the gateway dies?** The gateway runs as two pods behind one Kubernetes Service, so traffic goes to the surviving pod and Kubernetes starts a replacement. I measured it through the NodePort Service tunnel: 107 of 107 requests returned 200 while one gateway pod was deleted. If both pods die, everything is unreachable until Kubernetes restarts them. (A kubectl port-forward is tied to one pod, so after deleting that pod I must start it again.)

**Spring Boot basics that may come up**

31. **`@RestController`, `@Service`, `@Repository`, `@Transactional`?** Controller returns JSON; service holds business logic; repository talks to the database (Spring Data JPA builds queries from method names); `@Transactional` makes a method one all-or-nothing database transaction.
32. **Why DTOs (records) and not entities in responses?** So the API contract stays stable and internal fields (password hash) never leak.
33. **What does `@RabbitListener` do?** Spring keeps a consumer on the queue and calls the method for every message on a background thread; returning normally acknowledges the message.
34. **How is validation done?** Bean Validation annotations (`@NotBlank`, `@Size`) with `@Valid`; one `@RestControllerAdvice` turns every error into the standard JSON error body.

---

## H. Honest limitations and what I would improve

- **Not built:** real cloud hosting (the public link is a temporary Cloudflare quick tunnel to the laptop, started with `scripts/start-public-url.ps1`), admin endpoints to create responders or set them offline, an outbox pattern, Flyway, a dead-letter queue, NetworkPolicy, HTTPS.
- **Known behaviour:** a POST sent in the very second a pod dies can fail once (not retried on purpose); a lost event if RabbitMQ is down; the gateway sees a restarted service a few seconds late because its registry copy refreshes every 5 s.
- **Would improve:** outbox pattern, one Postgres per service, Flyway, mTLS/NetworkPolicy, autoscaling, rate limiting, refresh tokens.

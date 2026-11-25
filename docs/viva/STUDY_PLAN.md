# ResQNet Lite - 3-Hour Study Plan (for the viva)

Goal: after these three hours you can explain the project from the request on the screen down to the database, Docker and Kubernetes.
Do the blocks in order. Say the explanations **out loud**; reading silently is not enough for a viva.

| Block | Time | What |
|---|---|---|
| A | 20 min | The big picture |
| B | 60 min | Code tour in IntelliJ IDEA |
| C | 30 min | Run the demo yourself, twice |
| D | 30 min | Practise the questions out loud |
| E | 25 min | "What if..." drills |
| F | 15 min | Honest limits and last checks |

---

## A. The big picture (20 min)

1. Read `docs/viva/QUICK_REVISION.md` (one page).
2. Open the six pictures in `docs/diagrams/` in this order and explain each one in one sentence:
   `01-system-architecture.png`, `02-report-incident-sequence.png`, `03-fallback-sequence.png`, `04-event-flow.png`, `05-database-er.png`, `06-minikube-deployment.png`.
3. Say the one-minute introduction from `docs/viva/VIVA_SCRIPT.md` section A1 without looking.

## B. Code tour in IntelliJ IDEA (60 min)

How to open the project: each service is its own Maven project (there is no parent pom), so in IntelliJ use **File > Open**, choose the repository folder, then in the **Maven** tool window click **+** and add each service's `pom.xml` one by one (or simply open one service folder at a time). Set the project SDK to **JDK 17**. (I could not verify these IntelliJ clicks myself; they are the standard steps.)

For every stop: open the file, find the thing named, and say what it does and which rubric row it serves.

| # | File | Look for | Say |
|---|---|---|---|
| 1 | `api-gateway/src/main/java/com/resqnet/gateway/security/JwtAuthenticationFilter.java` | the method `filter`: strip headers, public routes, verify token, add headers | "The only place a JWT is checked. Bad token: 401 right here." (Security) |
| 2 | `api-gateway/src/main/java/com/resqnet/gateway/config/GatewayRoutes.java` | `lb://incident-service`, the `retry` settings, no `/internal` route | "Routes by service name through Eureka; retries GET only." (Gateway, Handles traffic) |
| 3 | `auth-service/src/main/java/com/resqnet/auth/service/AuthService.java` and `JwtService.java` | `register`, `login`, `issueToken` | "BCrypt, role always USER, HS256 token with expiry." (Security) |
| 4 | `incident-service/src/main/java/com/resqnet/incident/controller/IncidentController.java`, then `incident-service/src/main/java/com/resqnet/incident/service/IncidentService.java` | `create`, `tryAssign`, `dispatch`, `resolve` | "Controller is thin. Save, then call the responder service, then save again." |
| 5 | `incident-service/src/main/java/com/resqnet/incident/client/ResponderClient.java` and `incident-service/src/main/resources/application.yml` | `@CircuitBreaker`, `assignFallback`, the `resilience4j` block | "Timeout, breaker, fallback to PENDING." (Resilience) |
| 6 | `responder-service/src/main/java/com/resqnet/responder/repository/ResponderRepository.java`, `responder-service/src/main/java/com/resqnet/responder/service/ResponderService.java`, `responder-service/src/main/resources/schema.sql` | `FOR UPDATE SKIP LOCKED`, `assign`, the unique index | "Row lock so two incidents never get the same ambulance." (Database, Communication) |
| 7 | `incident-service/src/main/java/com/resqnet/incident/messaging/IncidentEventPublisher.java` and `RabbitConfig.java` | `convertAndSend`, exchange, queue, binding `incident.*` | "Fire-and-forget event; a failed publish never fails the request." (Communication) |
| 8 | `notification-service/src/main/java/com/resqnet/notification/messaging/IncidentEventListener.java` and `notification-service/src/main/java/com/resqnet/notification/service/NotificationService.java` | `@RabbitListener`, `existsByEventId`, the reject for malformed events | "Idempotent consumer: the same event never makes two notifications." |
| 9 | `discovery-service/src/main/java/com/resqnet/discovery/DiscoveryServiceApplication.java` and `incident-service/src/main/java/com/resqnet/incident/config/RestClientConfig.java` | `@EnableEurekaServer`, `@LoadBalanced` | "The registry, and a client that finds responder-service by name." (Service discovery) |
| 10 | `responder-service/src/test/java/com/resqnet/responder/service/ResponderServiceConcurrencyTest.java`, `incident-service/src/test/java/com/resqnet/incident/service/IncidentFlowTest.java`, `api-gateway/src/test/java/com/resqnet/gateway/config/GatewayRetryTest.java` | the test names | "Real PostgreSQL in a container, 10 parallel assignments, fake responder that hangs, a dead pod." Run them from IntelliJ (Docker must be running). (Testing) |
| 11 | `k8s/21-incident.yaml`, `k8s/22-responder.yaml`, `k8s/02-config.yaml`, `k8s/01-secrets.yaml` | `replicas: 2`, `readinessProbe:`, `wait-for-postgres`, the secrets are DEMO values | "Deployments, probes, init container, config kept outside the image." (Deployed) |
| 12 | `scripts/rehearsal.ps1` | the list of steps | "One command deletes the cluster, redeploys and runs every check." |

Also glance at one `Dockerfile` (`auth-service/Dockerfile`) and `db/init-databases.sh`.

## C. Run the demo yourself, twice (30 min)

1. Make sure the cluster is up: `kubectl -n resqnet get pods` (10 pods `1/1`).
2. Follow `docs/demo/DEMO_SCRIPT.md` from the first line, typing every command. Time yourself: target 5 minutes.
3. Do it a second time without reading, then once with the public link (`.\scripts\start-public-url.ps1`, section "Optional: a public link").
4. If a step surprises you, read the "If something goes wrong" table at the end of the demo script.

## D. Practise the questions out loud (30 min)

Open `docs/viva/VIVA_SCRIPT.md` section G. Cover the answers, read each question, answer out loud, then compare. Mark the ones you stumble on and repeat them. Priority questions: 7 to 11 (resilience), 14 to 16 (atomic assignment), 19 to 21 (security), 24 to 26 (discovery and load balancing), 35 (is it cloud hosted).

## E. "What if..." drills (25 min)

| If the examiner asks / does... | Answer and where to point |
|---|---|
| "Show me where the token is checked" | `JwtAuthenticationFilter.filter` (api-gateway); call the API with no token -> 401 |
| "Kill the responder service now" | `kubectl -n resqnet scale deploy/responder-service --replicas=0`, report an incident -> `PENDING`; `ResponderClient.assignFallback` |
| "What if two people report at the same moment?" | `lockFirstAvailable` with `FOR UPDATE SKIP LOCKED`; `ResponderServiceConcurrencyTest` |
| "Show load balancing" | `.\scripts\load-test.ps1`; the two pod names in the `X-Served-By` split |
| "Delete a pod" | `kubectl -n resqnet delete pod <incident pod>`; or `.\scripts\demo-failover.ps1`; Kubernetes recreates it, GETs keep returning 200 |
| "Show me the databases are separate" | `kubectl -n resqnet exec deploy/postgres -- psql -U postgres -c "\l"`; `db/init-databases.sh` (`REVOKE CONNECT`) |
| "Is this really on Kubernetes?" | `kubectl -n resqnet get pods`, `kubectl -n resqnet get svc`; Minikube is a local Kubernetes cluster |
| "Where are your tests?" | `.\scripts\run-unit-tests.ps1` (69 tests); `docs/TEST_REPORT.md` |
| "A command fails live" | stay calm, run `.\scripts\demo-resilience.ps1` or `.\scripts\smoke-test.ps1`; they prove the same things with PASS/FAIL lines |

## F. Honest limits and last checks (15 min)

- Read `docs/viva/VIVA_SCRIPT.md` section H. It is better to say "I did not build that, and here is how I would" than to bluff.
- Things you did not build: real cloud hosting (the public link is a tunnel to your laptop), admin endpoints to create responders or set them offline, an outbox pattern, HTTPS inside the cluster, a dead-letter queue.
- The day before: close heavy applications, start Docker Desktop and Minikube, run `.\scripts\rehearsal.ps1` once (about 5 minutes), and keep `docs/viva/QUICK_REVISION.md` open.
- Close the public tunnel after the demo: anyone with the link can use the demo, including the admin login.

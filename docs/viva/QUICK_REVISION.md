# ResQNet Lite - Quick Revision (one page)

**One sentence:** a user reports an emergency; the system saves it, asks a separate service for a free responder, assigns it, and records a notification; if the responder service is down the incident is still accepted as `PENDING`.

## Architecture
Client -> **api-gateway :8080** (JWT check, routes by name via Eureka, retries GET) -> services. incident -> responder = **sync REST** (circuit breaker + fallback). incident -> RabbitMQ -> notification = **async event**. All in Minikube namespace `resqnet`.

| Service | Port | Database | Job |
|---|---|---|---|
| api-gateway (x2) | 8080 | - | only entry point, JWT, routing, retry, 503/404 JSON |
| auth-service | 8081 | auth_db | register, login (BCrypt), issue JWT, `/me` |
| incident-service (x2) | 8082 | incident_db | incidents, sync call, breaker, publish events |
| responder-service | 8083 | responder_db | responders, atomic assign/release |
| notification-service | 8084 | notification_db | consume events, store notifications |
| discovery-service | 8761 | - | Eureka registry |
| PostgreSQL / RabbitMQ | 5432 / 5672, 15672 | 4 DBs, 4 users | one server, one broker |

## Endpoints (all via gateway, prefix `/api`)
`POST /auth/register` `POST /auth/login` (public) | `GET /auth/me` | `POST /incidents` `GET /incidents` `GET /incidents/{id}` | `POST /incidents/{id}/dispatch` `POST /incidents/{id}/resolve` (ADMIN) | `GET /responders` `GET /responders/{id}` | `GET /notifications` `PATCH /notifications/{id}/read` | `GET /actuator/health` (public). Internal only: `POST /internal/responders/assign`, `POST /internal/responders/{id}/release` (never routed).
Statuses: `REPORTED -> ASSIGNED | PENDING`, `PENDING -> ASSIGNED` (dispatch), `ASSIGNED -> RESOLVED`. Demo logins: `admin` / `Admin@123`; register your own user (`Pass@1234`).

## Annotations to explain
`@SpringBootApplication` start-up | `@RestController` JSON endpoints | `@Valid` validation | `@RestControllerAdvice` one error format | `@Transactional` all-or-nothing DB work | `@Entity` table | `@CircuitBreaker(fallbackMethod)` resilience | `@LoadBalanced` find a service by name | `@RabbitListener` consume queue | `@EnableEurekaServer` registry | `@Component`/`GlobalFilter` gateway JWT filter.

## Commands
```powershell
minikube start --driver=docker --cpus=4 --memory=4096
.\scripts\deploy-minikube.ps1                                   # build + load images + apply + wait
kubectl -n resqnet get pods
kubectl -n resqnet port-forward svc/api-gateway 8080:8080
kubectl -n resqnet scale deploy/responder-service --replicas=0  # then --replicas=1
kubectl -n resqnet logs deploy/incident-service --tail=30
kubectl -n resqnet exec deploy/postgres -- psql -U postgres -c "\l"
.\scripts\smoke-test.ps1 ; .\scripts\demo-resilience.ps1 ; .\scripts\demo-failover.ps1 ; .\scripts\load-test.ps1
.\scripts\rehearsal.ps1                                         # everything from a clean cluster
.\scripts\run-unit-tests.ps1                                    # 51 JUnit tests
kubectl delete ns resqnet                                       # wipe
```

## Rubric -> where to show it
| Criterion | Show |
|---|---|
| Deployed | `kubectl -n resqnet get pods` (10 pods Running: 2 api-gateway, 2 incident-service); only gateway is NodePort; `.\scripts\start-public-url.ps1` gives a temporary public https link (Cloudflare quick tunnel to the laptop, not cloud hosting) |
| Handles traffic | 2 incident pods; `.\scripts\load-test.ps1`: 1,500 requests all 200, 50/50 split by `X-Served-By`; `.\scripts\demo-failover.ps1` |
| Database | `psql \l` shows 4 DBs; `incident_user` cannot connect to `auth_db` |
| Cross-service communication | sync: incident -> responder REST; async: RabbitMQ event -> notification appears |
| Resilience | scale responder to 0: incident `PENDING`, login/notifications still work |
| Service discovery and gateway | Eureka dashboard `:8761`, routes `lb://...` in `GatewayRoutes` |
| Security | no token -> 401; USER on dispatch -> 403; forged header ignored |
| Testing | 51 JUnit tests + scripts + Postman (`docs/TEST_REPORT.md`) |

## 10 key talking points
1. Five business services + registry; each service owns its database and its code (no shared library).
2. Only the gateway is exposed; JWT is verified only there; services trust the verified `X-User-*` headers.
3. Gateway strips forged headers and never routes `/internal/**`.
4. Sync call because the answer is needed now; async event because a notification is a side effect.
5. Atomic assignment: `FOR UPDATE SKIP LOCKED` in one transaction + unique index; tested with 10 parallel requests.
6. Circuit breaker: window 5, min 3 calls, 50 %, 10 s open; 1 s connect / 2 s read timeout; fallback = `PENDING`.
7. 409 "none free" is not a breaker failure; both end in `PENDING`.
8. Idempotent consumer: `eventId` unique; duplicates skipped; bad messages rejected without requeue.
9. Eureka + load balancer: round-robin over copies; gateway retries GET only (never POST).
10. Everything proven from a clean cluster by `scripts/rehearsal.ps1`; honest limits: the public link is only a tunnel to the laptop, no outbox (a lost event if RabbitMQ is down), demo secrets, no HTTPS.

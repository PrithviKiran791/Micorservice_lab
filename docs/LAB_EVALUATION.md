# Lab evaluation: the eight criteria

The running application has a page for this, **Lab evaluation** (`/app/lab`, administrators), which shows for every criterion the implementation, recorded evidence, live checks against the running system and a status. This document is the same content on paper, plus how to demonstrate each criterion.

## How a status is decided

| Status | Rule |
|---|---|
| PASS | recorded results exist **and** every live check passes right now (a criterion that cannot be re-checked live, Testing, relies on recorded results alone and says so) |
| PARTIAL | recorded results exist but a live check fails or cannot be read now, **or** live checks pass but nothing was recorded |
| NOT VERIFIED | neither |

The existence of a source file or a configuration is never evidence. Values are labelled **Live** (read now), **Calculated** (computed in the browser from live API answers), **Recorded evidence** (a result stored in the repository, with its file name) or **Design** (a fact about the architecture). The logic is `frontend/src/utils/labEvaluation.ts` with unit tests (`labEvaluation.test.ts`).

## The criteria

| # | Criterion | Implementation (where to look) | Live checks on the page | Recorded evidence |
|---|---|---|---|---|
| 1 | Deployment | `*/Dockerfile`, `k8s/*.yaml`, `scripts/deploy-minikube.ps1`; only the gateway is a NodePort | Kubernetes API readable, every deployment fully ready, only the gateway exposed | `docs/evidence/rehearsal-run5-10pods.txt` (clean-cluster rehearsal passed) |
| 2 | Traffic handling and load balancing | 2 gateway and 2 incident-service replicas, `lb://` routes, GET retry (`GatewayRoutes.java`) | 2 healthy gateway replicas, 2 healthy incident replicas, requests counted on both incident pods | load test: 1500 requests, 249/251 split; failover: 0 of 114 failed (`docs/evidence/`) |
| 3 | Database integration | `db/init-databases.sh`, JPA per service | all four databases UP (the services' own db health checks), incidents read back | `incident_user` refused on `auth_db` (`docs/TEST_REPORT.md` A2); smoke test |
| 4 | Inter-service communication | `ResponderClient.java` (sync REST), `IncidentEventPublisher.java` / `IncidentEventListener.java` (RabbitMQ) | responder service UP, RabbitMQ connected, an incident has an assigned responder | smoke test (event arrives as a notification), Postman |
| 5 | Resilience | `@CircuitBreaker` + fallback in `ResponderClient.java`, thresholds in `incident-service/application.yml` | breaker state readable from the incident pods | `demo-resilience.ps1` 16/16, `demo-failover.ps1` 7/7 |
| 6 | Service discovery and gateway | `discovery-service`, eureka config of every service, `GatewayRoutes.java` | discovery UP, registry readable by the gateway, all five services registered and healthy | smoke test, failover demo |
| 7 | Security | `JwtAuthenticationFilter.java`, `AuthService.java` (BCrypt), `CurrentUser.requireAdmin()` | three anonymous requests answered 401 (run on page load); the Security page runs ten more | smoke test (forged, expired, wrong-issuer tokens, 403 for USER) |
| 8 | Testing | JUnit per service, smoke test, Postman, load test, resilience test | none (recorded results only) | unit tests 5 / 14 / 4 / 19 / 9, integration, API, load, resilience (`docs/evidence/`) |

## How to demonstrate each one (about 10 minutes in total)

1. **Deployment:** `kubectl -n resqnet get deploy,pods,svc`, then Service health > Kubernetes.
2. **Traffic:** `.\scripts\load-test.ps1`, then Service health > Load balancing (both pods' counters rise, about 50/50).
3. **Database:** Service health > Databases; `kubectl -n resqnet exec deploy/postgres -- psql -U postgres -c "\l"`.
4. **Communication:** report an incident as a reporter; the notification arrives (RabbitMQ) and the incident shows the assigned responder (REST).
5. **Resilience:** follow workflow 2 below.
6. **Discovery and gateway:** Service health > Discovery; delete an incident pod and watch the instance count fall and recover.
7. **Security:** Security page, "Run basic checks" and "Run reporter checks".
8. **Testing:** `.\scripts\run-unit-tests.ps1`, `.\scripts\smoke-test.ps1`.

## Demonstration workflows (also on the Lab evaluation page)

1. **Normal dispatch:** reporter reports a medical emergency; the ambulance is assigned; the notification appears; status ASSIGNED.
2. **Resilience:** `kubectl -n resqnet scale deploy/responder-service --replicas=0`; report an incident (PENDING); `... --replicas=1`; the administrator dispatches it (ASSIGNED). There is deliberately **no browser button** that stops a service.
3. **Load balancing:** `.\scripts\load-test.ps1` (run from PowerShell, not from the browser), then read the counters.
4. **Security:** run the checks on the Security page, sign out and open a protected page, sign in as USER and as ADMIN.

## What was observed when workflow 2 was run on the live cluster (25 Nov 2026)

* With the responder pod stopped, the operations API reported `responder-service` DOWN and `responder_db` UNKNOWN (not UP): the dashboard does not guess.
* Four incidents reported meanwhile were accepted and stored as PENDING (the fallback ran, visible in the incident-service log as `FALLBACK used`).
* The circuit breaker **stayed CLOSED**. Reason: when the pod stops gracefully Eureka removes it at once, so the call fails immediately with `IllegalArgumentException: Service Instance cannot be null`; that exception is not in the breaker's `record-exceptions`, so Resilience4j counts it as a success. The breaker opens when the service is registered but not answering (a crash before the lease expires, a timeout, HTTP 5xx), which is what the unit tests cover. The dashboard states this next to the breaker. Adding the exception to `record-exceptions` would make the breaker open in this case too; it was not changed because it alters existing resilience behaviour.
* After `--replicas=1` the responder service returned to UP, and the administrator's dispatch turned three of the pending incidents ASSIGNED; the fourth stayed PENDING because all three ambulances were then busy (correct: no free responder).

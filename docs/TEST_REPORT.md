# ResQNet Lite - Test Report

Date of the final runs: 25 Nov 2026. Environment: Windows 11, JDK 17, Docker Desktop, Minikube (docker driver, containerd), Spring Boot 3.5.16.
Raw logs are in [`docs/evidence/`](evidence/). "PASS" below means I ran the command and read the result.

**Two separate parts:** Part A tests the application. Part B tests the scripts and documents themselves. A passing Part A does not prove that a demo script is right, and the reverse.

---

# Part A - Application testing

## A1. Automated JUnit tests (`.\scripts\run-unit-tests.ps1`, JDK 17, Docker running)

| Service | Tests | Result | What they cover |
|---|---|---|---|
| auth-service | 5 | PASS | duplicate username -> 409 `USERNAME_TAKEN`; registration always role `USER` and stores only the BCrypt hash; wrong password and unknown user give the same 401 `INVALID_CREDENTIALS`; login returns a Bearer token |
| api-gateway | 30 | PASS | operations API (9): 401 without or with a bad/expired token, 403 for USER, DEGRADED / DOWN / UNKNOWN reported from fake Eureka and services, no secrets leaked, Kubernetes unavailable outside a cluster; web UI route (7): UI served without a token, SPA paths forwarded unchanged, `/api` still 401, unknown `/api` and `/internal` 404 and never sent to the UI, UI route is GET/HEAD only; missing, garbage, non-Bearer, expired, wrong-secret, wrong-issuer and unknown-role tokens are rejected with 401 and never forwarded; valid token forwarded with trusted `X-User-*`; forged headers replaced (also on public routes); login/register public, `/auth/me` not; short secret fails at start-up; **retry:** GET succeeds although one of two copies is dead, POST is never retried |
| responder-service (real PostgreSQL via Testcontainers) | 4 | PASS | 10 simultaneous assignments for 3 ambulances give exactly 3 distinct responders and 7 refusals; assign is idempotent per incident; release is idempotent; release for another incident is refused |
| incident-service (real PostgreSQL + real circuit breaker + fake responder server) | 19 | PASS | assigned; 409 -> `PENDING` without touching the breaker; connection refused, 3 s hang (read timeout) and HTTP 500 -> `PENDING` quickly; 3 failures open the breaker and no request reaches the responder while it is open; dispatch / resolve rules and 409s; resolve while responder is down -> 503 and state unchanged; USER 403 on admin endpoints; ownership and listing rules; 404; events: `incident.assigned`, `incident.pending`, unique `eventId`, broker failure never fails the request, failed dispatch publishes nothing |
| notification-service (real PostgreSQL) | 9 | PASS | template texts; duplicate `eventId` creates one notification, also with 8 simultaneous copies; malformed events rejected without requeue; incident-service JSON (with its foreign `__TypeId__` header) is understood; own/all/`mine` listing; mark-read rules (403, 404) |
| discovery-service | 0 | - | no application logic of its own (Eureka); verified through the cluster tests below |
| **Total** | **67** | **PASS** | command: `.\scripts\run-unit-tests.ps1`, exit code 0 (logs: `docs/evidence/unit-tests-*.txt`) |

Test quality check: the responder concurrency test was run with the row lock removed from the SQL and **failed** ("responder handed out twice"); the gateway retry test was run with GET retry switched off and **failed** (503 instead of 200). Both locks were restored afterwards.

## A2. Docker and Kubernetes

| What | Command | Expected | Actual | Result |
|---|---|---|---|---|
| Six images build | `.\scripts\deploy-minikube.ps1` (runs `docker build` per service and `minikube image load`) | exit 0 | exit 0 | PASS |
| Clean-cluster deploy | `kubectl delete ns resqnet` then `.\scripts\deploy-minikube.ps1 -SkipBuild -SkipImages` | all deployments roll out | 9 pods `1/1 Running` after 80-104 s, in 4 separate clean runs | PASS |
| No restarts | `kubectl -n resqnet get pods` | RESTARTS 0 | 0 for all pods in the last 4 clean runs (9 pods, then 10 pods after the second gateway replica) | PASS |
| Only the gateway is exposed | `kubectl -n resqnet get svc` | gateway NodePort, rest ClusterIP | as expected | PASS |
| Four databases, four users | `kubectl -n resqnet exec deploy/postgres -- psql -U postgres -c "\l"` | `auth_db`, `incident_db`, `responder_db`, `notification_db` | listed | PASS |
| One service cannot open another's database | `psql` as `incident_user` against `auth_db` (local compose Postgres) | refused | `FATAL: permission denied for database "auth_db" ... User does not have CONNECT privilege` | PASS |
| Restart behaviour: Postgres pod deleted | delete the pod, wait, list incidents | data still there | 3 incidents before and after; new incidents work (run on 25 Nov, ad-hoc script) | PASS |
| Restart behaviour: service pods deleted | delete incident / auth / notification / responder / gateway pods | recreated, data kept, old JWT still valid | all recreated, 6 incidents before and after, login 200, old token accepted (ad-hoc script) | PASS |

## A3. End-to-end through the gateway (all on a freshly deployed cluster)

| What | Command | Expected | Actual | Result |
|---|---|---|---|---|
| Smoke test | `.\scripts\smoke-test.ps1` | all checks pass, exit 0 | **37 of 37** (health, 401/403, register/login, incident, notification via RabbitMQ, forged/expired/wrong-secret/wrong-issuer tokens, forged header, roles, dispatch/resolve, validation) | PASS |
| Authentication checklist (`docs/AUTHENTICATION.md` section 11) | covered by the smoke test | cases 1-10 | 1 no token, 2 garbage, 3 other secret, 4 expired, 5 register+login, 6 create incident, 7 USER dispatch 403, 8 forged `X-User-Role` 403, 9 other user's incident 403, 10 `/internal` not routed (smoke accepts 401 or 404 without a token; 404 with a valid token was checked with an ad-hoc script: 19 of 19 checks passed) | PASS |
| Postman collection | newman, folders 0-5 | all assertions pass | 28 requests in the collection (every one has status-code tests); folders 0-5: **43 of 43 assertions** | PASS |
| Resilience demo | `.\scripts\demo-resilience.ps1` | incident `PENDING` fast, others answer, recovery | **16 of 16**: scale to 0 -> `PENDING` in about 50 ms, `GET /api/responders` 503, login/list/notifications 200, "waiting" notification arrives, scale to 1 -> dispatch `ASSIGNED`, `/api/responders` 200 again after about 3 s | PASS |
| Failover demo | `.\scripts\demo-failover.ps1` | every GET returns 200 while an incident pod is deleted | **7 of 7**: 111 of 111 requests 200, slowest 1.09 s, replacement pod Ready, both pods answer again | PASS |
| Load test | `.\scripts\load-test.ps1` | no errors, load shared by both incident pods | 20 users, 1,500 requests, **all HTTP 200**, 127-146 requests/s, avg 134-153 ms, p95 236-295 ms; `/api/incidents` 250 + 250 over the two pods (3 clean runs) | PASS |
| Async event outage cases (ad-hoc, 25 Nov) | scale notification-service to 0 / RabbitMQ to 0 | events wait / incident still accepted | notification down: `rabbitmqctl` showed 2 messages and 0 consumers, `GET /api/notifications` 503, after scale-up 4 notifications and queue 0; RabbitMQ down: incident still 201 in 58 ms (that one event is lost, documented trade-off) | PASS |
| Duplicate and malformed events (ad-hoc, 25 Nov) | publish the same `eventId` twice and two broken messages through the RabbitMQ API | one notification; queue empty | 1 notification for incident 9001; queue 0 messages, 1 consumer | PASS |
| Public link (Cloudflare quick tunnel) | `.\scripts\start-public-url.ps1 -Check` | the whole smoke test passes through a public https address | opened `https://ready-fifth-mileage-processing.trycloudflare.com` (a temporary address, now closed): **37 of 37** smoke checks passed through it, exit code 0, no cloudflared process left running | PASS |
| Gateway failover through the NodePort Service (ad-hoc, 25 Nov) | delete one of the two gateway pods while sending GET requests through `minikube service api-gateway --url` | no failed request | 107 of 107 requests returned 200; replacement pod Ready | PASS |
| Whole rehearsal from a clean cluster | `.\scripts\rehearsal.ps1` | `REHEARSAL PASSED` | passed in 5 separate clean-cluster runs (the fifth with **10 pods**, i.e. two api-gateway replicas: smoke 37/37, resilience 16/16, failover 7/7, newman 43/43, load 1,500 x 200, references 43/43, `docs/evidence/rehearsal-run5-10pods.txt`); the third added the failover step and **the fourth rebuilt all 6 jars and 6 images from source** (`-Rebuild`: deploy 258 s, smoke 37/37, resilience 16/16, failover 7/7, Postman 43/43, load 1,500 x 200 at 151 requests/s with a 251/249 pod split, references 43/43, 0 restarts); logs `docs/evidence/rehearsal-run1.txt`, `-run2.txt`, `-run3.txt`, `-run4-rebuild.txt` | PASS |

## A4. Bugs found by application testing and how they were fixed

| # | Found by | Bug | Fix |
|---|---|---|---|
| 1 | first start of auth-service | PostgreSQL rejected the JVM time zone `Asia/Calcutta` | UTC set in each `main()` and for the test JVM (`argLine`) |
| 2 | incident-service tests | Resilience4j failed to start (Spring Cloud BOM pinned an older `resilience4j-spring6`) | BOM scope fixed; later the BOM manages one consistent version |
| 3 | gateway check | error `path` showed `/auth/register` instead of `/api/auth/register`; `X-Forwarded-Prefix` is overwritten by the gateway itself | gateway sets `X-Gateway-Prefix`, services use it |
| 4 | first Minikube deploy | app pods crashed 3 times while Postgres ran its init script | init container waits for Postgres (and RabbitMQ for notification-service) |
| 5 | incident tests after adding Eureka | all success paths became `PENDING` (test discovery could not resolve the fake server) | tests use a plain client bean; the Eureka path is verified in the cluster |
| 6 | pod deletion under traffic | old gateway: 9 of 32 requests failed (eight 503, one 30 s hang) | gateway retries GET on another copy, 1 s connect timeout: 0 of 114 failed, slowest 1.08 s |
| 7 | load test under host memory pressure | 81 timeouts, all pods restarted once (Windows out of memory, Docker VM starved) | lighter JVM (serial GC, C1, small stacks), 768 Mi limit, startup probe 450 s; later load tests all 200 |
| 8 | rehearsal run | `GET /api/responders` still 503 right after responder-service returned (gateway's registry copy lags up to about 13 s) | behaviour documented; the check now waits for recovery (3 s observed) |

---

# Part B - Script and documentation testing

## A5. Web frontend and operations command center (added 25 Nov 2026)

| What | How | Result |
|---|---|---|
| Unit tests: statistics, JWT expiry, validation, formatting, error mapping, token storage, route guards, role navigation, lab-evaluation status rules | `cd frontend; npm test` (Vitest) | 57 passed |
| Type check and production build | `npm run typecheck; npm run build` (strict TypeScript) | pass |
| Gateway tests incl. UI route and operations API | `.\scripts\run-unit-tests.ps1` | gateway 30 passed; all services 67 passed, 0 failed |
| Docker image and Kubernetes (no namespace deletion) | `docker build`, `minikube image load`, `kubectl apply`, rollout restarts | 11 pods Ready; `/`, `/app/incidents` (refresh) and assets 200; `/api/incidents` without token 401; `/api/nothing` 404; `/internal/...` 404 |
| Backend unchanged | `.\scripts\smoke-test.ps1` after the first UI deployment | 37 passed, 0 failed |
| Operations API on the live cluster | `GET /api/ops/health | resilience | traffic | kubernetes` as ADMIN; no token 401 | all six services, Eureka, four databases, RabbitMQ, breaker per pod, request counters per pod and 9 deployments / 11 pods reported from live sources |
| Live security demonstration (Security page) | 10 real requests through the gateway | 10 of 10 as expected: 401 x4, 404 (internal), 200 x2, 403 x3 (reporter token, also with a forged `X-User-Role: ADMIN`) |
| Lab evaluation page | opened as ADMIN against the live cluster after generating traffic | 8 of 8 PASS, each with its stated basis (Testing: recorded results only) |
| Resilience scenario on the live cluster | `kubectl scale deploy/responder-service --replicas=0`, 4 incidents reported, `--replicas=1`, admin dispatch | responder DOWN and `responder_db` UNKNOWN reported (not UP); 4 incidents stored as PENDING; after recovery UP again; 3 incidents ASSIGNED by dispatch, the 4th stayed PENDING (all 3 ambulances busy); see the finding below |
| Role navigation and routing | browser as reporter and as ADMIN | reporter sees Overview, Report emergency, My incidents, Notifications, Profile; `/app/health` redirects to the overview; admin sees the 10 operations pages |
| Mobile layout (375 px) | Service health, Architecture, Lab evaluation, Security, Operations overview | no horizontal page scroll on any of them; tables scroll inside their cards |
| Incident detail via `GET /api/incidents/{id}` and responder detail via `GET /api/responders/{id}` | dialogs and deep link `?open=<id>` | detail loads the single incident; another user's incident shows "This incident is not yours" (403) |

**Finding from the resilience run (not a defect of the dashboard):** with the responder pod stopped gracefully, Eureka removes it immediately, so the call fails at once with `IllegalArgumentException: Service Instance cannot be null`. That exception is not in the breaker's `record-exceptions`, so Resilience4j counts it as a success: the fallback ran (incidents became PENDING, log line `FALLBACK used`) but the circuit breaker stayed CLOSED. The breaker opens when the service is registered but not answering, which `IncidentFlowTest` covers. The dashboard shows the true state and explains this. Adding the exception to `record-exceptions` would make the breaker open here too; it was not changed because it alters existing resilience behaviour.

**Observed once:** a rolling update of the UI pod returned one HTTP 503 from the gateway (pooled connection to the old pod). The UI route now retries GET like the API routes.

## B1. Scripts

| Script | How it was tested | Result | Bug found and fixed |
|---|---|---|---|
| `scripts/deploy-minikube.ps1` | parser syntax check; run from a deleted namespace 6+ times, exit code 0 | PASS | aborted on harmless `kubectl` stderr under Windows PowerShell 5.1 -> error preference changed; wait time raised for slow machines |
| `scripts/lib.ps1` | dot-sourced by every script below (syntax check + use) | PASS | - |
| `scripts/smoke-test.ps1` | syntax check; 37 of 37 on clean clusters; exit code 0 | PASS | - |
| `scripts/demo-resilience.ps1` | syntax check; 16 of 16 on clean clusters; a failing check produced exit 1 (seen once in a rehearsal) | PASS | final check was timing-sensitive -> now polls up to 45 s |
| `scripts/demo-failover.ps1` | syntax check; ran against the old gateway (5 passed, 2 failed, as intended) and the new one (7 of 7) | PASS | my first version passed `-split` to `kubectl` (readiness checks never worked) -> helper function |
| `scripts/load-test.ps1` | syntax check; 3 clean runs, exit code 0; it exits 1 when requests fail or only one pod answers (seen in the failed memory-pressure run) | PASS | - |
| `scripts/verify-references.ps1` | 43 of 43 correct; **negative test** with a wrong line, a missing file and a moved snippet: reported all three (with "snippet is now on line N") and exit 1 | PASS | - |
| `scripts/generate-references.ps1` | generated `docs/viva/CODE_REFERENCES.md` (43 references from the real source) | PASS | the "snippet not found" error path was not exercised |
| `scripts/start-public-url.ps1` | syntax check; ran with `-Check` (opens the tunnel, runs the smoke test through the public address, closes it); `cloudflared.exe` download checked against the GitHub release SHA-256 and its Cloudflare signature | PASS | first version failed reading the tunnel log while cloudflared was still writing it ("file in use") -> shared-access read |
| `scripts/rehearsal.ps1` | 3 complete runs; one earlier run failed at deploy because of memory pressure | PASS | child-script output was swallowed by my first version -> output shown live |
| `scripts/run-unit-tests.ps1` | ran all services, exit code 0, table printed | PASS | - |
| `scripts/verify-docs.ps1` | see B2 | PASS | its first run found real errors in my documents |

## B2. Human-followed documents

| Document | What was done | Result |
|---|---|---|
| `docs/demo/DEMO_SCRIPT.md` | **followed from the first line** on the live cluster, typing the commands as written (helper function, 401, register/login, report incident, notifications, scale to 0, report again, login/notifications/responders, scale to 1, admin dispatch, `psql \l`) | PASS: every step gave the documented result (ASSIGNED, notification text, PENDING in 52 ms, 503 only on `/api/responders`, ASSIGNED after the admin dispatch). One real observation: the first dispatch attempt returned `PENDING` and the second (5 s later) `ASSIGNED`; the document already tells the presenter to wait and repeat. |
| Demo extras (Eureka page, RabbitMQ UI, scripts) | opened `http://localhost:8761` and `http://localhost:15672` through port-forward; logged in with `resqnet` / `rabbit-demo` | PASS: Eureka lists the five services; RabbitMQ shows queue `notification.incidents` with 1 consumer (checked by HTTP/API, not by looking at the page) |
| `docs/viva/VIVA_SCRIPT.md` and `QUICK_REVISION.md` | every command in section F and the quick sheet was run (`get pods`, `get svc`, `logs deploy/incident-service --tail=30`, `describe pod`, `exec ... psql`, `rollout restart`, `scale`, `delete pod`); file paths, classes and methods checked by `verify-docs.ps1`; test counts and numbers taken from the runs above | PASS |
| `docs/viva/CODE_REFERENCES.md` | `.\scripts\verify-references.ps1` | PASS: 43 of 43 |
| Documents as a whole | `.\scripts\verify-docs.ps1` checks every file path, link, script option, `Class.method` and Kubernetes deployment/service name | first run: **9 wrong** (abbreviated `.../` paths in the demo script, a not-yet-written report, a false positive on `.java` names) -> fixed; final run below |
| `README.md` setup (Minikube) | the commands are the ones executed by `deploy-minikube.ps1`, `rehearsal.ps1` and the scripts above | PASS |
| `docs/diagrams/` (6 diagrams) | rendered with `@mermaid-js/mermaid-cli`; each PNG opened and read | PASS: two diagrams were simplified after the first render (overlapping labels, too many arrows); fallback sequence had a Mermaid syntax error (a semicolon in a note) -> fixed |

## B3. NOT independently verified (please check these yourself)

| Item | Why | How you can verify |
|---|---|---|
| Postman **desktop app** | only the collection was run with newman (the command-line runner) | import `postman/ResQNet-Lite.postman_collection.json`, start the port-forward, run folders 0-5 in the Collection Runner; folder 6 needs the `kubectl scale` commands in its description |
| Eureka dashboard and RabbitMQ UI **as seen in a browser** | checked by HTTP status and API only | open `http://localhost:8761` and `http://localhost:15672` after the port-forwards |
| README option B (run locally without Kubernetes: `docker compose up -d` and `mvn spring-boot:run` per service, discovery-service first) | services were run locally earlier in the project, but not re-run in the final state with Eureka | follow section 6B of the README once |
| Public link from **another device** ("Deployed" criterion) | the tunnel was tested from the same laptop (traffic went out to Cloudflare and back through the public `trycloudflare.com` name), not from a phone or another computer | run `.\scripts\start-public-url.ps1`, open the printed address on a phone using mobile data (not the same Wi-Fi), e.g. `<address>/actuator/health` |
| Web UI in other browsers and on a real phone | only the built-in Chromium browser and its 375 px emulation were used; there are no automated end-to-end browser tests (the GitHub Actions job `frontend` runs type check, unit tests and build and passed on the previous push) | open the gateway address in your own browser and phone |
| Behaviour on a different machine | everything ran on one laptop | run `.\scripts\rehearsal.ps1 -Rebuild` on the evaluation machine beforehand |
| Behaviour when Windows is short of memory | a failed run showed the cluster slows down badly; fixed by lighter settings but not guaranteed | close heavy applications before the demo |

## B4. Final documentation check

`.\scripts\verify-docs.ps1` (final run): see the last line of `docs/evidence/verify-docs.txt`.

# ResQNet Lite - Final Checklist (Phase 7)

Status on 25 Nov 2026. "Evidence" points to a file in this repository or a command you can run.

## A. Deliverables (from the implementation brief, section 11)

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 1 | Services that build, run and pass their tests | DONE | six services (five plus the Eureka registry); `.\scripts\run-unit-tests.ps1` -> 67 tests pass; `.\scripts\rehearsal.ps1 -Rebuild` builds all six jars and images |
| 2 | 4 databases, 4 users, no cross-database access | DONE | `db/init-databases.sh`; `psql \l`; `incident_user` is refused on `auth_db` (`docs/TEST_REPORT.md` A2) |
| 3 | One synchronous REST call and one asynchronous RabbitMQ event, both demonstrated | DONE | `.\scripts\smoke-test.ps1` sections 3 and 4; `docs/diagrams/02-report-incident-sequence.png`, `04-event-flow.png` |
| 4 | Circuit breaker fallback demonstrated by scaling responder-service to 0 | DONE | `.\scripts\demo-resilience.ps1` (16 checks) |
| 5 | JWT enforced at the gateway (401/403 cases shown) | DONE | `.\scripts\smoke-test.ps1` (37 checks incl. forged, expired, wrong-secret tokens); `JwtAuthenticationFilterTest` |
| 6 | All pods Running on Minikube; reachable through the gateway via port-forward | DONE | `kubectl -n resqnet get pods` (10 pods, 0 restarts); `kubectl -n resqnet port-forward svc/api-gateway 8080:8080` |
| 7 | `scripts/` working and tested; Postman collection with tests | DONE | `docs/TEST_REPORT.md` Part B; `postman/ResQNet-Lite.postman_collection.json` (newman: 43 assertions) |
| 8 | README, VIVA_SCRIPT, QUICK_REVISION, DEMO_SCRIPT, TEST_REPORT, six diagrams | DONE | `README.md`, `docs/viva/`, `docs/demo/DEMO_SCRIPT.md`, `docs/TEST_REPORT.md`, `docs/diagrams/` |
| 9 | `verify-references.ps1` passes | DONE | 43 of 43 (`docs/viva/CODE_REFERENCES.md`); also `.\scripts\verify-docs.ps1` |
| 10 | Full demo rehearsed twice from `kubectl delete ns resqnet` and a fresh deploy | DONE (4 times) | `docs/evidence/rehearsal-run1.txt` ... `rehearsal-run4-rebuild.txt` |
| 11 | `docs/tracker.md` fully updated; "NOT independently verified" list handed over | DONE | tracker audited (open items are owner-side or stretch, each labelled); list in `docs/TEST_REPORT.md` B3 and below |

## B. The eight lab criteria

| Criterion | Status | Evidence |
|---|---|---|
| Deployed (public or lab URL) | DONE with a caveat | 10 pods on Minikube; `.\scripts\start-public-url.ps1` gives a temporary public https link (tunnel to the laptop, **not cloud hosting**); smoke test passed through it; not yet tried from another device |
| Handles traffic | DONE | `.\scripts\load-test.ps1` (1,500 requests, all 200, 50/50 over 2 pods); `.\scripts\demo-failover.ps1` |
| Database | DONE | see A2 |
| Cross-service communication | DONE | see A3 |
| Resilience | DONE | see A4 |
| Service discovery and gateway | DONE | `discovery-service`, `GatewayRoutes` (`lb://`) |
| Security | DONE | see A5 |
| Testing | DONE | `docs/TEST_REPORT.md` |

## C. Not independently verified (owner actions)

| What | How to check |
|---|---|
| Public link from another device | `.\scripts\start-public-url.ps1`, open `<address>/actuator/health` on a phone using mobile data |
| Postman desktop app | import `postman/ResQNet-Lite.postman_collection.json`, run folders 0-5 with the gateway port-forward running |
| Eureka page and RabbitMQ UI in a browser | `http://localhost:8761` and `http://localhost:15672` (user `resqnet`, password `rabbit-demo`) after the port-forwards in `docs/demo/DEMO_SCRIPT.md` |
| README option B (run locally without Kubernetes) | follow README section 6 B once |
| IntelliJ project setup | follow `docs/viva/STUDY_PLAN.md` block B |
| Another machine | run `.\scripts\rehearsal.ps1 -Rebuild` on the machine you will present from |
| Memory pressure | close heavy applications before the demo (a failed run in this project showed how slow the cluster becomes) |
| Screen recording backup | record one successful `.\scripts\rehearsal.ps1` or demo run |

## D. Security reminders

- All passwords and the JWT secret in `k8s/01-secrets.yaml` and `application-local.yml` are DEMO values. Never reuse them.
- The demo admin login (`admin` / `Admin@123`) is created automatically; while the public tunnel is open anyone with the link can use it. Close the tunnel after the demo.

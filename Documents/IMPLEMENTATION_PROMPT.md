

You are my software architect, Spring Boot developer, Docker/Kubernetes engineer, tester, technical
writer and viva coach. Take ownership of building **ResQNet Lite** end to end and make it demo-ready.

The project topic, architecture, API, schema, security design and rules are **already decided**.
Do not re-evaluate topics, do not propose alternatives, and do not wait for approval of the design.
Your job is to implement it, verify it, deploy it on Minikube, and prepare me to present it.

---

## 1. Mission and success criteria

Graded by a 20-mark rubric. Everything you do must serve it:

| Criterion | Marks | Minimum evidence |
|---|---|---|
| Deployment | 5 | Services deployed on Minikube |
| Database | 4 | Each service has its own database |
| Cross-service communication | 4 | One synchronous call and one asynchronous event |
| Resilience | 4 | A demo of one service going down while others still answer |
| Security | 3 | Authentication checked at the gateway |

**Done means:** all five rows demonstrably work on Minikube, the demo script runs cleanly twice from a
fresh cluster, and I can explain the project in a viva after 2 to 3 hours of study.

**Time budget:** `12` working hours (I will edit this number if it changes). If you fall behind, cut
stretch items first, then polish, never a rubric row. Tell me before dropping anything mandatory.

**Cost:** everything must cost Rs 0. Never enable billing, start trials, or add paid services.

---

## 2. What is already decided (read before writing any code)

The repository contains these documents. Read **all of them first**, in this order of authority
(higher wins if they disagree):

1. `docs/API_CONTRACT.md` endpoints, payloads, status codes, events
2. `docs/schema.md` tables, enums, state machines, seed data
3. `docs/AUTHENTICATION.md` JWT, gateway filter, headers, role matrix
4. `docs/Architecture.md` services, ports, flows, deployment, configuration
5. `docs/rules.md` MUST / MUST NOT rules (scope, coding, Kubernetes, git)
6. `docs/PRD.md` scope and acceptance criteria
7. `docs/ui.md` Postman collection first; static page is optional
8. `docs/tracker.md` task list and status (you keep this updated)
9. `AGENTS.md` repo conventions and commands

**Fixed design in one paragraph:** five Spring Boot apps (api-gateway, auth-service, incident-service,
responder-service, notification-service) plus PostgreSQL (four databases, four users) and RabbitMQ in
Minikube namespace `resqnet`. incident-service calls responder-service synchronously (Resilience4j
circuit breaker with `PENDING` fallback) and publishes `incident.assigned` / `incident.pending` events
that notification-service consumes. The gateway validates JWTs and sets `X-User-*` headers. Ports are
8080 (gateway), 8081 (auth), 8082 (incident), 8083 (responder), 8084 (notification).

**If a document is wrong, impossible, or inconsistent:** fix the document in the same commit, add a line
to the Decisions log in `docs/tracker.md`, and mention it in your next progress report. Never deviate
silently, and never invent requirements the rubric does not contain.

---

## 3. Environment and preflight (keep it short)

My machine: Windows 11, PowerShell, Docker Desktop (WSL2), Minikube (docker driver), JDK 17, Maven, kubectl.

**Step A. Inspect what you can actually do.** Run and record the output of:

```powershell
java -version; mvn -version; git --version
docker version; docker run --rm hello-world
kubectl version --client; minikube version; minikube status
```

**Step B. Send me ONE consolidated message** listing only things you cannot do yourself, for example:
Docker Desktop not running, Minikube not started, missing tools to install, or whether I want the code
pushed to a GitHub repository (and if so, that you need me to authorize it). Then continue with every
independent task while waiting. Do not ask again for routine actions.

**You may do without asking:** create/edit files in the project folder, install project dependencies
(Maven), run builds and tests, run containers, build images, apply manifests to the local Minikube
cluster, generate docs and diagrams, make local git commits.

**Never, without asking me:** push to a remote, install system-wide software, change Windows/Docker/WSL
settings, touch files outside the project folder, delete anything I did not ask you to delete,
create cloud accounts, or use any paid service. Never print or commit real secrets (the demo values
in `k8s/01-secrets.yaml` are labelled as demo secrets).

If something is blocked on me, pause only that item, add it to a "Blocked on you" list, and continue.

---

## 4. Execution plan and exit criteria

Work in phases. After each phase: run its checks, update `docs/tracker.md`, commit, and send a short
progress report (format in section 9). Do not start the next phase until the current phase's exit criteria pass.

| Phase | Time | Work | Exit criteria (all verified by running them) |
|---|---|---|---|
| 0 Preflight | 0.5 h | Section 3; confirm project skeleton exists or generate the five Spring Boot projects | Tools verified; each project compiles |
| 1 Foundation | 2 h | `docker-compose.yml` (Postgres with 4 DBs/users + RabbitMQ); auth-service; gateway routes + JWT filter | Register/login work through the gateway; no token gives 401; role header forwarding works |
| 2 Dispatch | 2.5 h | responder-service (seed, atomic assign/release); incident-service (create, list, get, dispatch, resolve, RestClient, circuit breaker, fallback) | Report incident gives `ASSIGNED`; stop responder gives `PENDING` in about 3 s; concurrent assign test passes |
| 3 Events | 1 h | RabbitMQ declarables, publisher, consumer, idempotent notifications, notification endpoints | Report incident creates a notification; duplicate event creates none |
| 4 Docker + Kubernetes | 2.5 h | Dockerfiles; `k8s/` manifests; images built in Minikube; port-forward; probes | All pods `1/1 Running`; full flow works in cluster; scale responder to 0 and back works |
| 5 Test and scripts | 1 h | Section 6 and 7: automated tests, smoke/demo scripts, Postman collection | All scripts pass from a clean cluster, twice |
| 6 Docs and diagrams | 1.5 h | Section 8 deliverables | Files exist; every command in them was run |
| 7 Final QA | 1 h | Section 6 and 7 final passes; fresh-cluster rehearsal | `docs/TEST_REPORT.md` complete; tracker fully ticked |

**De-risking rule:** at the end of Phase 2, deploy gateway + auth + one other service to Minikube once
(a "walking skeleton"). Kubernetes problems (image pulls, DNS names, Postgres/RabbitMQ wiring) are the
most likely time sink, so find them early.

---

## 5. Coding standards (the code must be explainable to a beginner)

- Straightforward Java 17 and standard Spring Boot conventions. No clever patterns, no unnecessary
  interfaces, abstractions, or dependencies. Follow `docs/rules.md`.
- **Comment for understanding:** every class gets a short "what and why" comment; every non-obvious
  method gets a purpose comment; explain important annotations (`@RestController`, `@Transactional`,
  `@CircuitBreaker`, `@RabbitListener`, and so on) the first time they appear in each service. Comments
  explain intent, not syntax. Keep methods short.
- Use DTOs (records are fine), a global `@RestControllerAdvice`, and the standard error body from the contract.
- Comment the three hard ideas especially well, because I will be asked about them: the **atomic
  assignment** (row lock), the **circuit breaker fallback**, and the **gateway JWT filter**.
- Versions: pick the latest stable Spring Boot 3.x and the matching Spring Cloud release train; verify
  compatibility with an actual build. Define gateway routes in a Java `RouteLocator` bean (property
  names changed between Spring Cloud versions).
- Do not claim a build passes unless you ran it and read the output.

---

## 6. Testing, category A: application testing

Run continuously, not only at the end. For each service, after implementing it: compile, start, read the
startup log, call its endpoints (valid and invalid), and confirm database writes.

Minimum automated tests (JUnit 5 + Mockito, or Spring test slices):

1. responder-service: two concurrent assignments never receive the same responder; assign is idempotent per incident.
2. incident-service: when the responder client throws (connection error/timeout/open breaker), the incident becomes `PENDING` and an event is published; when it returns 409 it also becomes `PENDING`.
3. api-gateway: JWT filter rejects missing/garbage/expired/wrongly-signed tokens, accepts a valid one, and strips forged `X-User-*` headers.
4. notification-service: a duplicate `eventId` does not create a second notification.
5. auth-service: duplicate username returns 409; wrong password returns 401; registration always yields `USER`.

Also verify and record: Docker image builds and container startup; every pod `Ready`; the 10-case checklist
in `docs/AUTHENTICATION.md`; the demo flow in `docs/PRD.md` section 10 in the actual cluster; restart
behaviour (delete a pod, confirm it returns and data persists).

---

## 7. Testing, category B: scripts and documentation testing (separate and mandatory)

Create these scripts in `scripts/` (PowerShell, Windows 11, `Invoke-RestMethod`, no extra tools):

| Script | Purpose |
|---|---|
| `scripts/deploy-minikube.ps1` | Point Docker at Minikube, build 5 jars and images, apply `k8s/`, wait for pods Ready |
| `scripts/smoke-test.ps1` | Health, 401 without token, register, login, report incident, check notification, admin dispatch/resolve, 403 for USER on admin endpoint; prints PASS/FAIL per step and sets exit code |
| `scripts/demo-resilience.ps1` | Scale responder-service to 0, report incident (expect `PENDING`), confirm login/notifications still work, scale to 1, dispatch (expect `ASSIGNED`) |
| `scripts/verify-references.ps1` | For every `path:line` reference in the viva docs, check the quoted snippet really appears at that line |

For every script: check syntax, run it on a clean cluster, check the exit code and output, fix, re-run.
For every human-followed document (`DEMO_SCRIPT.md`, `README.md` setup steps, viva commands): follow it
from the first line as a first-time user, verify each command, URL, filename, class and method named
exists, fix anything wrong, then walk through it again.

**Keep application results and script/documentation results separate** in `docs/TEST_REPORT.md`
(tables: what was tested, command, expected, actual, PASS/FAIL, bug and fix). A passing application test
does not prove the demo script is right, and the reverse.

**Honesty rule:** mark something "verified" only if you executed or followed it and saw the result.
Anything needing my account, my hands, or my screen is marked "NOT independently verified" with exact
instructions for me to check it.

---

## 8. Documentation and diagrams (do after the system works)

Keep these focused. Quality and accuracy matter more than volume. Everything must describe what was
actually built.

| File | Content |
|---|---|
| `README.md` | Overview, problem, features, stack, architecture picture, local setup, Minikube setup, test instructions, demo steps, links |
| `docs/viva/VIVA_SCRIPT.md` | (a) 1-minute and 3-minute project introductions; (b) step-by-step demo narration; (c) walkthrough of key files: path, purpose, important classes/methods/annotations, rubric row served; (d) request-flow explanations (happy path, fallback, event); (e) Docker and Kubernetes explained simply, with the exact commands to show pods, logs, restart, scale; (f) **about 30 likely viva questions with short answers**, prioritising questions about the real code (atomic assignment, circuit breaker, database per service, sync vs async, JWT at gateway, why Minikube, limitations) |
| `docs/viva/QUICK_REVISION.md` | One page: architecture, services and ports, endpoints, annotations, commands, rubric mapping, 10 key talking points |
| `docs/demo/DEMO_SCRIPT.md` | Timed 5-minute demo: what to run, what to say, what happens, which file is responsible. Matches `docs/PRD.md` section 10 and uses the scripts and Postman collection |
| `postman/ResQNet-Lite.postman_collection.json` | As specified in `docs/ui.md`, with status-code tests |
| `docs/TEST_REPORT.md` | Results from sections 6 and 7 |

**Code references:** for about 10 to 15 key concepts, give `path:line` plus the snippet, generated from
the final source with `grep -n`, never typed from memory, and checked by `scripts/verify-references.ps1`.
Also name the class and method so the reference survives small edits.

**Diagrams** (accurate to the implementation, no components that were not built): Mermaid sources in
`docs/diagrams/sources/*.mmd` plus rendered PNGs in `docs/diagrams/`. Create these six:
1. System architecture, 2. Report-incident sequence (happy path), 3. Fallback sequence (responder down),
4. Event flow (RabbitMQ), 5. Database-per-service ER view, 6. Minikube deployment view.
Render with `npx -y @mermaid-js/mermaid-cli` or another free local tool. If PNG rendering is not possible
on this machine, keep the Mermaid sources, say so plainly, and tell me how to render them.

No separate USER_MANUAL is needed unless the optional UI is built.

---

## 9. Progress reporting and tracker

- Keep `docs/tracker.md` current. Tick an item only after verification. Add a work-log line per task.
- After each phase send a report of at most 15 lines: done, tests run (application vs script/doc, with
  PASS/FAIL), bugs found and fixed, what is next, on schedule or not, and the "Blocked on you" list.
- Commit after every working step using the message format in `docs/rules.md` (`feat(incident): ...`).
  Commit locally; push only if I authorized it.
- When you hit an error, show the key line of the error, say what you changed, and show it passing.
  Do not report success on a build, test, deploy or script you did not run.

---

## 10. Optional stretch (only after Phases 0 to 7 are verified, in this order)

1. **Temporary public URL** (the lab brief mentions hosting for the class): expose the gateway running
   on my laptop's Minikube through a free quick tunnel, for example
   `cloudflared tunnel --url http://localhost:8080` (verify current free-tier behaviour first; no billing,
   no account unless free). Describe it honestly as a tunnel to my laptop, not cloud hosting. Needs my
   confirmation before installing anything.
2. Scheduler that retries `PENDING` incidents every 30 seconds.
3. Optional static demo page from `docs/ui.md` (level L2).
4. Two replicas of the gateway and incident-service to show load balancing.
5. GitHub Actions workflow: build and test only.

Never trade rubric items, testing, or the rehearsal for any of these.

---

## 11. Final deliverables checklist

- [ ] Five services that build, run and pass their tests
- [ ] 4 databases, 4 users, no cross-database access
- [ ] One synchronous REST call and one asynchronous RabbitMQ event, both demonstrated
- [ ] Circuit breaker fallback demonstrated by scaling responder-service to 0
- [ ] JWT enforced at the gateway (401/403 cases shown)
- [ ] All pods Running on Minikube; reachable through the gateway via port-forward
- [ ] `scripts/` working and tested; Postman collection with tests
- [ ] README, VIVA_SCRIPT, QUICK_REVISION, DEMO_SCRIPT, TEST_REPORT, six diagrams
- [ ] `verify-references.ps1` passes
- [ ] Full demo rehearsed twice from `kubectl delete ns resqnet` and a fresh deploy
- [ ] `docs/tracker.md` fully updated; "NOT independently verified" list handed to me

## 12. Start now

1. Read all documents listed in section 2.
2. Run Step A and send the single consolidated message from Step B.
3. Begin Phase 0 and continue through the phases without waiting for approval of the design.

# Web frontend and operations command center

The web UI in `frontend/` is a single-page app (React 19, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts, Lucide icons).
It is only a client: it talks to the **API Gateway** and nothing else, and every rule (login, roles, validation) is still enforced by the backend.
The UI hides what a role may not do, but it never replaces the check at the gateway and in the services.

Two portals in one app:

* **Reporter portal (USER):** deliberately small: Overview, Report emergency, My incidents, Notifications, Profile.
* **Operations command center (ADMIN):** Operations overview, Incidents, Responders, Notifications, Analytics, Service health, Architecture, Lab evaluation, Security, Settings.

## How it is served

```text
browser --> api-gateway (:8080) --+--> /api/ops/**    --> answered by the gateway itself (ADMIN only, read-only)
                                  +--> /api/**        --> auth / incident / responder / notification (JWT checked)
                                  +--> /internal/**   --> 404 (never routed)
                                  +--> /actuator/**   --> gateway's own health
                                  +--> everything else (GET/HEAD) --> frontend service (nginx, ClusterIP)
```

* One origin: the page and the API share one address, so the UI calls the relative URL `/api` (`VITE_API_BASE_URL=/api`). No address is hard-coded, so the same build works on `localhost`, in Minikube and behind the Cloudflare tunnel.
* The gateway route `frontend` (`GatewayRoutes.java`) has the lowest priority and only accepts GET/HEAD (with the same safe GET retry as the API routes, so replacing the UI pod does not show an error). The JWT filter lets this route through without a token (the HTML/JS/CSS must load before login); all other routes keep requiring a token. Unknown `/api/**` paths still return the gateway's JSON 404, never the UI.
* nginx (`frontend/nginx.conf`) serves `index.html` for every unknown path, so refreshing `/app/incidents` works; files in `/assets/` have hashed names and are cached for a year.
* Kubernetes: `k8s/40-frontend.yaml` (Deployment `frontend`, 1 replica, probe `/healthz`, plus a ClusterIP Service on port 80). The gateway finds it by the URL `http://frontend` (override with `FRONTEND_URL`).

## Pages and who may use them

| Route | Page | USER | ADMIN | Backend calls |
|---|---|---|---|---|
| `/` | Landing | yes | yes | none |
| `/login`, `/register` | Sign in / create reporter account | guests | guests | `POST /api/auth/login`, `/register` |
| `/app/overview` | Reporter overview | yes | (goes to operations overview) | `GET /api/incidents`, `/api/responders` |
| `/app/report` | Report emergency, with an optional **map position picker** | yes | yes | `POST /api/incidents` (with `latitude` / `longitude` when a position was chosen) |
| `/app/incidents` | My incidents (USER) / Incidents (ADMIN); the detail dialog loads `GET /api/incidents/{id}`; deep link `?open=<id>` | own incidents | all, dispatch / resolve | `GET /api/incidents[?status]`, `GET /api/incidents/{id}`, `POST .../dispatch`, `.../resolve` |
| `/app/notifications` | Notifications | own | own | `GET /api/notifications`, `PATCH .../{id}/read` |
| `/app/settings` | Profile (USER) / Settings (ADMIN) | yes | yes | `GET /api/auth/me` |
| `/app/admin` | **Operations overview**: key counters, the **incident map** with filters and side panel (critical queue, recent incidents, incidents without a position), pending queue, dispatch, responder panel, platform health (see `docs/MAP.md`) | redirected | yes | incidents, responders, `GET /api/ops/health`, dispatch |
| `/app/responders` | Responder directory; the detail dialog loads `GET /api/responders/{id}` | direct URL only | yes | `GET /api/responders[?status&type]`, `GET /api/responders/{id}` |
| `/app/analytics` | Charts computed from the API answers | direct URL only | yes | the same GETs |
| `/app/health` | **Service health**: services, Eureka, load balancing, databases, RabbitMQ, resilience, Kubernetes | redirected | yes | `GET /api/ops/*` |
| `/app/architecture` | **Architecture**: interactive diagram with live component state | redirected | yes | `GET /api/ops/health`, `/kubernetes` |
| `/app/lab` | **Lab evaluation**: eight criteria, live checks, recorded evidence, demo workflows | redirected | yes | `GET /api/ops/*`, incidents, anonymous security probes |
| `/app/security` | **Security**: session, role matrix, live 401/403 demonstration | redirected | yes | anonymous and token requests, a temporary reporter |

## Where every number comes from

The command center never mixes measured and recorded values. Each block carries a small tag:

| Tag | Meaning | Examples |
|---|---|---|
| **Live** | read from the running system when the page refreshed | service health, Eureka registrations, database and RabbitMQ connectivity, circuit-breaker state, request counters per pod, deployments and pods |
| **Calculated** | computed in the browser from live API answers | incident counters, PENDING count, charts |
| **Recorded evidence** | a result stored in the repository, shown with its file name and date | load-test summary, unit-test counts, rehearsal results (`frontend/src/data/evidence.ts`) |
| **Design** | a fact about the architecture from the code and manifests | the architecture diagram, role matrix |
| **Unavailable** | the source could not be read; no value is shown | an unreachable Kubernetes API, message rates |

Unavailable is never shown as zero: a responder count with the responder service down shows "-" and "Unavailable, not zero".

## The operations API (the only backend addition)

The browser may not talk to Eureka, the services' actuator endpoints, PostgreSQL, RabbitMQ or Kubernetes, and the existing public API does not expose their state. So the **api-gateway** answers four read-only, ADMIN-only endpoints itself: `GET /api/ops/health`, `/resilience`, `/traffic`, `/kubernetes` (contract in `docs/API_CONTRACT.md` section 11, audit in `docs/INTEGRATION_AUDIT.md`).

| Information | Real source |
|---|---|
| service health and instance counts | Eureka `/eureka/apps` and each instance's `/actuator/health` |
| database connectivity | the `db` health component of each service (its own connection test) |
| RabbitMQ connectivity | the `rabbit` health component of incident-service and notification-service |
| circuit breaker | `/actuator/circuitbreakers` and `/actuator/circuitbreakerevents` of each incident-service pod |
| request distribution | Micrometer `http.server.requests` of each pod |
| deployments, replicas, pods | Kubernetes API, read-only ServiceAccount (`k8s/31-gateway-rbac.yaml`) |

Changes outside the gateway are configuration only: `show-components: always` (component names and UP/DOWN, no details) and exposure of `metrics` / `circuitbreakers` / `circuitbreakerevents`, reachable only inside the cluster.

## How the UI handles the backend

* **Token:** returned by login, kept in `sessionStorage` (gone when the tab closes), sent as `Authorization: Bearer ...` by one Axios instance (`src/services/http.ts`). It is never logged, shown or put in a URL. The token's `exp` is read only to log the user out when it runs out.
* **401 on a protected call:** the session is cleared and the user lands on the login page with "Your session ended".
* **Errors:** every failure becomes one `AppError` built from the standard error body. Network failures and 503 get their own wording.
* **Responder service down:** `GET /api/responders` answers 503, so the Responders page shows an "unavailable" state and the dashboards show "-" with "Unavailable". Reporting an incident still works and the report is `PENDING`.
* **Live data:** lists, notifications and the command center refresh by polling (default 5 s; 3/5/10/30 s or off in Settings; paused while the tab is hidden). There is no WebSocket in this project.
* **Pod name:** the response header `X-Served-By` is shown in the top bar, which makes load balancing visible.

## Failure injection and tests are not browser buttons

There is deliberately no button that stops a service or starts a load test. The demo workflows on the Lab evaluation page show the `kubectl` and PowerShell commands to run instead, so nothing destructive can be triggered from a browser. The Security page does send real requests, but only harmless ones (requests that are meant to be refused, plus one temporary reporter account created and discarded in memory).

## Gaps: what the UI cannot do because the API has no endpoint

Nothing below was invented or faked in the UI.

| Wanted | Why it is missing | What the UI does |
|---|---|---|
| Create, edit or set a responder OFFLINE (admin) | no such endpoint (optional in the PRD) | responders are read-only |
| Analytics history | none exists | charts are computed in the browser from the incident and responder lists |
| Number of times the fallback ran | Resilience4j keeps no such counter for this call | the evidence shown is breaker state, recent events and the PENDING incidents |
| Message rates, queue depth | not exposed (RabbitMQ management stays private) | shown as not measured |
| Database performance | not measured | only connectivity is shown |
| Per-route request counts at the gateway | the gateway does not publish them | distribution is measured at the incident-service pods; the limitation is stated on the page |
| Responder positions / live GPS | the responder service stores no coordinates and nothing reports them | responders are listed with availability and assignment only; incidents are mapped from the positions their reporters chose (`docs/MAP.md`) |
| "Mark all notifications read" | only `PATCH /{id}/read` exists | one PATCH per unread item |
| Server-side logout / refresh token | JWT is stateless, no endpoint | logout deletes the token in the browser |
| Security event counters | the gateway only logs rejections | no "attacks blocked" figure is shown |

## Run it locally

Needs Node 20.19 or newer (22 recommended). The backend must be reachable on port 8080 (for example `kubectl -n resqnet port-forward svc/api-gateway 8080:8080`).

```powershell
cd frontend
npm ci
npm run dev          # http://localhost:5173, proxies /api to http://localhost:8080
npm run typecheck
npm test             # 75 unit tests (Vitest)
npm run build        # production build in frontend/dist
```

Set `VITE_DEV_PROXY_TARGET` (see `frontend/.env.example`) to proxy to another gateway address. Do not use `VITE_API_BASE_URL` to point at a single microservice; the UI must always go through the gateway.

## Docker and Kubernetes

```powershell
docker build -t resqnet/frontend:1.0 ./frontend
minikube image load resqnet/frontend:1.0
kubectl apply -f k8s/40-frontend.yaml
kubectl -n resqnet rollout restart deploy/api-gateway     # only needed after the gateway code changed
kubectl -n resqnet port-forward svc/api-gateway 8080:8080 # then open http://localhost:8080
```

`scripts/deploy-minikube.ps1` builds and deploys the frontend together with the services. The public link from `scripts/start-public-url.ps1` is a tunnel to the gateway, so it serves the UI as well; the UI contains no tunnel address. The operations pages need the gateway's ServiceAccount from `k8s/31-gateway-rbac.yaml` (applied by the same script, `kubectl apply -f k8s/`).

## Tests

| Where | What | Result (25 Nov 2026) |
|---|---|---|
| `frontend/src/**/*.test.ts(x)` | statistics, JWT expiry, validation, formatting, error mapping, token storage, route guards, role navigation, lab-evaluation status rules | 75 passed |
| `GatewayFrontendRouteTest` | UI served without a token; SPA paths forwarded unchanged; `/api` still 401; unknown `/api` 404; `/internal` 404; only GET/HEAD | 7 passed |
| `OpsApiTest` | 401 without or with a bad/expired token, 403 for USER, real states from fake Eureka/services/Kubernetes (DEGRADED, DOWN, UNKNOWN), circuit-breaker and traffic parsing, no secrets leaked, no cluster means "unavailable" | 9 passed |
| `scripts/smoke-test.ps1` after deployment | all backend rules, unchanged | 37 passed |
| Browser run against the live cluster | every page as ADMIN and as a reporter; the Security checks (10/10 as expected); the responder-down scenario (see `docs/LAB_EVALUATION.md`) | see `docs/TEST_REPORT.md` |

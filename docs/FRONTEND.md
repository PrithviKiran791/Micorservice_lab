# Web frontend

The web UI in `frontend/` is a single-page app (React 19, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts, Lucide icons).
It is only a client: it talks to the **API Gateway** and nothing else, and every rule (login, roles, validation) is still enforced by the backend.
The UI hides what a role may not do, but it never replaces the check at the gateway and in the services.

## How it is served

```text
browser --> api-gateway (:8080) --+--> /api/**        --> auth / incident / responder / notification (JWT checked)
                                  +--> /internal/**   --> 404 (never routed)
                                  +--> /actuator/**   --> gateway's own health
                                  +--> everything else (GET/HEAD) --> frontend service (nginx, ClusterIP)
```

* One origin: the page and the API share one address, so the UI calls the relative URL `/api` (`VITE_API_BASE_URL=/api`). No address is hard-coded, so the same build works on `localhost`, in Minikube and behind the Cloudflare tunnel.
* The gateway route `frontend` (`GatewayRoutes.java`) has the lowest priority and only accepts GET/HEAD. The JWT filter lets this route through without a token (the HTML/JS/CSS must load before login); all other routes keep requiring a token. Unknown `/api/**` paths still return the gateway's JSON 404, never the UI.
* nginx (`frontend/nginx.conf`) serves `index.html` for every unknown path, so refreshing `/app/incidents` works; files in `/assets/` have hashed names and are cached for a year.
* Kubernetes: `k8s/40-frontend.yaml` (Deployment `frontend`, 1 replica, probe `/healthz`, plus a ClusterIP Service on port 80). The gateway finds it by the URL `http://frontend` (override with the environment variable `FRONTEND_URL`).

## Pages and who may use them

| Route | Page | USER | ADMIN | Backend calls |
|---|---|---|---|---|
| `/` | Landing | yes | yes | none |
| `/login`, `/register` | Sign in / create reporter account | guests | guests | `POST /api/auth/login`, `/register` |
| `/app/overview` | My dashboard | yes | (admin goes to the admin dashboard) | `GET /api/incidents`, `/api/responders` |
| `/app/admin` | Admin dashboard: queue, dispatch, snapshot | no (redirected) | yes | `GET /api/incidents`, `/api/responders`, `POST /api/incidents/{id}/dispatch`, `/resolve` |
| `/app/report` | Report emergency | yes | yes | `POST /api/incidents` |
| `/app/incidents` | Incidents list and detail (`?open=<id>`) | own incidents | all incidents, dispatch / resolve | `GET /api/incidents[?status]`, `/api/incidents/{id}`, `POST .../dispatch`, `.../resolve` |
| `/app/responders` | Responder availability (read-only) | yes | yes | `GET /api/responders[?status&type]` |
| `/app/notifications` | Notifications | own | own | `GET /api/notifications`, `PATCH /api/notifications/{id}/read` |
| `/app/analytics` | Charts | yes | yes | the same GETs, computed in the browser |
| `/app/settings` | Account, session, refresh interval, connection | yes | yes | `GET /api/auth/me` |

The sidebar shows only the pages a role may use; opening a forbidden address (for example `/app/admin` as a USER) redirects to the user's own home page.

## How the UI handles the backend

* **Token:** returned by login, kept in `sessionStorage` (gone when the tab closes), sent as `Authorization: Bearer ...` by one Axios instance (`src/services/http.ts`). It is never logged or put in a URL. The token's `exp` is read only to log the user out when it runs out; the UI does not verify tokens.
* **401 on a protected call:** the session is cleared and the user lands on the login page with "Your session ended".
* **Errors:** every failure becomes one `AppError` (`src/services/errors.ts`) built from the standard error body (`code`, `message`, field `details`). Network failures and 503 get their own wording.
* **Responder service down:** `GET /api/responders` answers 503, so the Responders page shows an "unavailable" state and the dashboards show "Responders free: -". Reporting an incident still works and the confirmation page says the report is `PENDING` (the fallback of the backend, not an error).
* **Live data:** notifications and lists refresh by polling (default 5 s; 3/5/10/30 s or off in Settings; paused while the tab is hidden). There is no WebSocket in this project.
* **Pod name:** the response header `X-Served-By` (set by incident-service) is shown in the top bar, which makes load balancing visible during the demo.

## Gaps: what the UI cannot do because the API has no endpoint

Nothing below was invented or faked in the UI. No backend change was made for them.

| Wanted | Why it is missing | What the UI does |
|---|---|---|
| Create, edit or set a responder OFFLINE (admin) | no such endpoint (listed as optional in the PRD) | Responders page is read-only |
| Analytics endpoint / history | none exists | charts are computed in the browser from `GET /api/incidents` and `/api/responders`; the page says so and that they cover only what the caller may see |
| Average response time, resolution time per responder | no timestamps for assignment | not shown |
| Map / GPS | the form's latitude/longitude are optional and the UI does not collect them | location is free text only |
| "Mark all notifications read" | only `PATCH /{id}/read` exists | the button sends one PATCH per unread item |
| Logout on the server / token refresh | JWT is stateless, no endpoint | logout deletes the token in the browser; the session ends after the token's 120 minutes |
| List all users (admin) | no endpoint | not shown |
| Cancel or edit an incident | not in the contract | not offered |

## Run it locally

Needs Node 20.19 or newer (22 recommended). The backend must be reachable on port 8080 (for example `kubectl -n resqnet port-forward svc/api-gateway 8080:8080`).

```powershell
cd frontend
npm ci
npm run dev          # http://localhost:5173, proxies /api to http://localhost:8080
npm run typecheck
npm test             # 41 unit tests (Vitest)
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

`scripts/deploy-minikube.ps1` builds and deploys the frontend together with the services. The public link from `scripts/start-public-url.ps1` is a tunnel to the gateway, so it serves the UI as well; the UI contains no tunnel address.

## Tests

| Where | What | Result (25 Nov 2026) |
|---|---|---|
| `frontend/src/**/*.test.ts(x)` | statistics, JWT expiry, validation, formatting, error mapping, token storage, route guards (roles, redirects) | 41 passed |
| `GatewayFrontendRouteTest` | UI served without a token; SPA paths forwarded unchanged; `/api` still 401; unknown `/api` 404 and never sent to the UI; `/internal` 404; only GET/HEAD on the UI route | 7 passed |
| `scripts/smoke-test.ps1` after deployment | all backend rules, unchanged | 37 passed |
| Browser run against the live cluster | login as admin and as a new reporter, report, dispatch, resolve, notifications, responder outage, expired session, role redirects | see `docs/TEST_REPORT.md` |

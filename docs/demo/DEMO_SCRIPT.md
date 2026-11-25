# ResQNet Lite - Demo Script (about 5 minutes + 2 optional)

## Before you start (do this 10 minutes earlier)

1. Close heavy applications (browser tabs, chat apps). The laptop needs free memory for Docker and Minikube.
2. Start Docker Desktop, then: `minikube start --driver=docker --cpus=4 --memory=4096` (skip if already running).
3. Deploy (or confirm): `.\scripts\deploy-minikube.ps1` and wait for it to print the pod list. Check: `kubectl -n resqnet get pods` shows 10 pods `1/1 Running`.
4. **Terminal 1** (leave open): `kubectl -n resqnet port-forward svc/api-gateway 8080:8080`
5. **Terminal 2** (you type here). Paste this helper once:

```powershell
$b = "http://localhost:8080"
function Call($method, $path, $body, $token) {
    $h = @{}; if ($token) { $h["Authorization"] = "Bearer $token" }
    try { if ($body) { Invoke-RestMethod -Method $method -Uri "$b$path" -Headers $h -ContentType application/json -Body ($body | ConvertTo-Json) }
          else       { Invoke-RestMethod -Method $method -Uri "$b$path" -Headers $h } }
    catch { "HTTP " + [int]$_.Exception.Response.StatusCode + "  " + $_.Exception.Message }
}
```

Postman alternative: import `postman/ResQNet-Lite.postman_collection.json` and run the folders in order (folder 6 is the resilience part).
Backup: if anything fails live, run `.\scripts\demo-resilience.ps1` (it performs the whole resilience story with PASS/FAIL lines).

---

## The 5-minute demo

| Time | What you do | What you type | What happens | What you say | Responsible code |
|---|---|---|---|---|---|
| 0:00 | Show the cluster | `kubectl -n resqnet get pods` | 10 pods `1/1 Running`, two `api-gateway` and two `incident-service` | "Six Spring Boot services, Postgres and RabbitMQ run as pods on Minikube. The gateway and the incident service each run two copies." | `k8s/*.yaml`, `scripts/deploy-minikube.ps1` |
| 0:30 | Security: no token | `Call GET /api/incidents` | `HTTP 401 ... Unauthorized` | "Authentication is checked at the gateway. This request never reached a service." | `JwtAuthenticationFilter` (api-gateway, `security` package) |
| 0:50 | Register and log in | `Call POST /api/auth/register @{username="asha";password="Pass@1234"}` then `$t = (Call POST /api/auth/login @{username="asha";password="Pass@1234"}).token` | user created (role `USER`), token stored | "Password is stored as a BCrypt hash. The login returns a signed JWT." (If `asha` exists, use another name.) | `AuthService`, `JwtService` (auth-service, `service` package) |
| 1:20 | Report an incident (SYNC call) | `Call POST /api/incidents @{type="MEDICAL";severity="CRITICAL";description="Person collapsed near library";locationText="Main Library, Gate 2"} $t` | `status ASSIGNED`, `assignedResponder` = an ambulance | "Incident-service saved it, then called responder-service synchronously. The responder service locked one free row so two reports can never get the same ambulance." | `ResponderClient` (incident-service), `ResponderRepository` (responder-service) |
| 1:50 | Show the async event | `Call GET /api/notifications $null $t` | one notification: "Incident #n (MEDICAL, CRITICAL) assigned to Ambulance ..." | "That notification was created asynchronously: incident-service published an event to RabbitMQ and notification-service consumed it." | `IncidentEventPublisher` (incident-service), `IncidentEventListener` (notification-service) |
| 2:20 | Break a service | `kubectl -n resqnet scale deploy/responder-service --replicas=0` | pod terminates | "I simulate the responder service crashing." | `k8s/22-responder.yaml` |
| 2:40 | Report again | the same `POST /api/incidents` command | **`status PENDING`** returned quickly | "The system degrades gracefully: timeout, circuit breaker and fallback. The incident is accepted as PENDING instead of an error." | `ResponderClient.assignFallback` (incident-service), `application.yml` (resilience4j) |
| 3:10 | The rest still answers | `Call GET /api/notifications $null $t` ; login again ; `Call GET /api/responders $null $t` | notifications OK, login OK, responders **`HTTP 503`** | "Only the dead service's own endpoint fails. Login, incidents and notifications still work." | `GatewayErrorHandler` (api-gateway, `config` package) |
| 3:40 | Fix it | `kubectl -n resqnet scale deploy/responder-service --replicas=1` and `kubectl -n resqnet get pods -w` until `1/1` (about 30 s, Ctrl+C) | new responder pod Ready | "Kubernetes starts it again." | Kubernetes |
| 4:10 | Dispatch as admin | `$a = (Call POST /api/auth/login @{username="admin";password="Admin@123"}).token` then `Call POST /api/incidents/<pending id>/dispatch $null $a` (the id is in the PENDING answer; if it says 503/PENDING wait 10 s and repeat) | `status ASSIGNED` | "The admin retried the dispatch and the waiting incident now has a responder." | `IncidentService.dispatch` |
| 4:30 | Database per service | `kubectl -n resqnet exec deploy/postgres -- psql -U postgres -c "\l"` | `auth_db`, `incident_db`, `responder_db`, `notification_db` | "Four databases and four users; a service cannot even connect to another's database." | `db/init-databases.sh` |
| 4:50 | Close | - | - | "That covers deployment, database per service, sync plus async communication, resilience and gateway security." | - |

If the PENDING dispatch at 4:10 answers `PENDING` again, the gateway or the circuit breaker has not noticed the returned service yet: wait 10-15 seconds and repeat.

---

## Optional extras (2 minutes)

| What | Command | Expected | Say |
|---|---|---|---|
| Service discovery | `kubectl -n resqnet port-forward svc/discovery-service 8761:8761` (new terminal), open `http://localhost:8761` | Eureka page lists API-GATEWAY, AUTH-SERVICE, INCIDENT-SERVICE (2 instances), RESPONDER-SERVICE, NOTIFICATION-SERVICE | "Services register by name; the gateway and incident-service look them up here." |
| Load balancing | `.\scripts\load-test.ps1` | 1,500 requests, all `200`, about 130-150 req/s, `/api/incidents` split 50% / 50% between two pod names | "Twenty users at once; the gateway shares the load between the two incident-service copies." |
| Failover | `.\scripts\demo-failover.ps1` | `all ... requests during the failover returned HTTP 200` and a replacement pod | "I delete one incident pod under traffic; the gateway retries on the other copy, nobody sees an error." |
| RabbitMQ UI | `kubectl -n resqnet port-forward svc/rabbitmq 15672:15672`, open `http://localhost:15672` (user `resqnet`, password `rabbit-demo`) | queue `notification.incidents` with 1 consumer | "This is the broker that carries the asynchronous events." |
| Everything automatically | `.\scripts\rehearsal.ps1` (about 5 minutes, deletes and rebuilds the namespace) | summary table ends with `REHEARSAL PASSED` | "All checks pass from a clean cluster." |


## Optional: a public link for the examiner (about 1 minute to set up)

Only if the evaluation asks for a URL "not just localhost". It is a temporary tunnel to your laptop, not cloud hosting; anyone with the link can use the system (including the demo admin login), so close it afterwards.

| Step | Command | Expected |
|---|---|---|
| Open | `.\scripts\start-public-url.ps1` (leave the window open; it runs its own port-forward, so you do not need Terminal 1) | prints `PUBLIC URL:  https://<random-words>.trycloudflare.com` |
| Use | replace `$b = "http://localhost:8080"` in the helper by the printed address and run the same demo commands | same results as above |
| Check | open `<public url>/actuator/health` in a browser | `{"status":"UP","groups":["liveness","readiness"]}` |
| Close | press Ctrl+C in that window | `Tunnel closed.` |
## If something goes wrong

| Problem | Fix |
|---|---|
| `Unable to connect to the remote server` | Terminal 1 (port-forward) stopped. Start it again. After a gateway pod restart it must be restarted. |
| A pod shows `0/1` for a while after start | JVMs are slow to start when the laptop is short of memory. Wait; check `kubectl -n resqnet get pods`. |
| `ErrImagePull` / `ImagePullBackOff` | Images are not in Minikube: run `.\scripts\deploy-minikube.ps1` (without `-SkipImages`). |
| Port 8080 already in use | Stop the other program, or use `kubectl ... port-forward svc/api-gateway 8081:8080` and set `$b = "http://localhost:8081"`. |
| You want a clean start | `kubectl delete ns resqnet` then `.\scripts\deploy-minikube.ps1 -SkipBuild -SkipImages` |

## Optional: the same demo in the browser (2 minutes)

Open the gateway address (`kubectl -n resqnet port-forward svc/api-gateway 8080:8080`, then `http://localhost:8080`) and sign in as `admin`.

1. **Service health:** every service, Eureka registrations, both incident pods, the four databases, RabbitMQ and the Kubernetes deployments, all read live.
2. **Architecture:** click Incident Service to show its connections (REST to the responder, RabbitMQ event to the notification service).
3. **Security:** press "Run basic checks" and "Run reporter checks": 401, 403 and 404 from the real gateway.
4. **Lab evaluation:** the eight criteria with their evidence and live checks; run `.\scripts\load-test.ps1` first so the load-balancing check has traffic to count.
5. For the resilience part keep **Service health > Resilience** open while you run the two `kubectl scale` commands from `docs/LAB_EVALUATION.md`.

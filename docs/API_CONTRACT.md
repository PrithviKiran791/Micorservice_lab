# API Contract - AegisFlow

Single source of truth for endpoints, payloads, status codes and events.
If code and this document disagree, fix one of them in the same commit.

## 1. Conventions

| Item | Rule |
|---|---|
| Base URL | `http://localhost:8080` (local run or `kubectl port-forward svc/api-gateway 8080:8080`) |
| Public prefix | All client calls start with `/api` |
| Content type | `application/json` (UTF-8) |
| Auth header | `Authorization: Bearer <jwt>` on every call except those marked Public |
| Timestamps | ISO-8601 UTC, e.g. `2026-11-25T14:30:00Z` |
| Ids | Numeric (`int64`) |
| Enums | Upper-case strings, exactly as in `docs/schema.md` |
| Lists | Plain JSON arrays, newest first, no pagination (MVP) |
| Unknown JSON fields | Ignored |

### Gateway path mapping

| Public path | Forwarded to | Service path |
|---|---|---|
| `/api/auth/**` | auth-service:8081 | `/auth/**` |
| `/api/incidents/**` | incident-service:8082 | `/incidents/**` |
| `/api/responders/**` | responder-service:8083 | `/responders/**` |
| `/api/notifications/**` | notification-service:8084 | `/notifications/**` |
| `/internal/**` | **never routed** | service-to-service only |

The gateway removes the `/api` prefix (`StripPrefix=1`). Document paths below are the **public** ones.

Targets are found **by name through Eureka** (`lb://auth-service`, `lb://incident-service` ...): when several copies of a service run, requests are shared round-robin. Failed **GET** requests (connection refused, reset, timeout, 502/503/504) are retried on another copy, at most 2 times; **POST/PATCH are never retried automatically**. Every service adds a response header `X-Served-By: <pod name>` so the load-balancing demo can show which copy answered.

### Identity headers (gateway -> services, never from clients)

`X-User-Id`, `X-User-Name`, `X-User-Role`. See `docs/AUTHENTICATION.md`.

The gateway also sets `X-Gateway-Prefix: /api` on routed requests so a service's error body can report the public path the client called (`path` field).

## 2. Standard error body

```json
{
  "timestamp": "2026-11-25T14:30:00Z",
  "status": 400,
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "path": "/api/incidents",
  "details": [ { "field": "description", "message": "must not be blank" } ]
}
```
`details` is present only for validation errors.

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad or missing fields |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token (from gateway) |
| 401 | `INVALID_CREDENTIALS` | Wrong username or password |
| 403 | `FORBIDDEN` | Role not allowed, or resource not owned |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `USERNAME_TAKEN` | Registration conflict |
| 409 | `NAME_TAKEN` | Responder name conflict |
| 409 | `INVALID_STATE` | Transition not allowed (e.g. dispatch a non-PENDING incident) |
| 409 | `NO_RESPONDER_AVAILABLE` | Internal assign found none (never returned to clients on create; becomes `PENDING`) |
| 503 | `SERVICE_UNAVAILABLE` | Downstream service down (also produced by the gateway) |
| 500 | `INTERNAL_ERROR` | Unexpected error |

## 3. Auth endpoints

### POST /api/auth/register  (Public)

Request
```json
{ "username": "asha", "password": "Pass@1234" }
```
Rules: username 3-50 chars `[A-Za-z0-9_.-]`; password 8-72 chars.

201
```json
{ "id": 2, "username": "asha", "role": "USER", "createdAt": "2026-11-25T14:30:00Z" }
```
Errors: 400 `VALIDATION_ERROR`, 409 `USERNAME_TAKEN`.

### POST /api/auth/login  (Public)

Request
```json
{ "username": "asha", "password": "Pass@1234" }
```
200
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer",
  "expiresInSeconds": 7200,
  "user": { "id": 2, "username": "asha", "role": "USER" }
}
```
Errors: 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS`.

### GET /api/auth/me  (USER, ADMIN)

200
```json
{ "id": 2, "username": "asha", "role": "USER" }
```

## 4. Incident endpoints

### Incident object

```json
{
  "id": 11,
  "type": "MEDICAL",
  "severity": "CRITICAL",
  "status": "ASSIGNED",
  "description": "Person collapsed near library",
  "locationText": "Main Library, Gate 2",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "reportedBy": { "userId": 2, "username": "asha" },
  "assignedResponder": { "id": 1, "name": "Ambulance Alpha", "type": "AMBULANCE" },
  "createdAt": "2026-11-25T14:30:00Z",
  "updatedAt": "2026-11-25T14:30:01Z",
  "resolvedAt": null
}
```
`assignedResponder` is `null` unless status is `ASSIGNED` (kept after `RESOLVED` for history). `latitude`/`longitude` may be `null`.

### POST /api/incidents  (USER, ADMIN)

Request
```json
{
  "type": "MEDICAL",
  "severity": "CRITICAL",
  "description": "Person collapsed near library",
  "locationText": "Main Library, Gate 2",
  "latitude": 12.9716,
  "longitude": 77.5946
}
```
Rules: `type`, `severity`, `description` (1-500), `locationText` (1-200) required; coordinates optional.

201 (responder found) -> Incident object with `"status": "ASSIGNED"` and `assignedResponder` filled.

201 (no responder, timeout or service down)
```json
{
  "id": 12,
  "type": "FIRE",
  "severity": "MEDIUM",
  "status": "PENDING",
  "description": "Smoke from chemistry lab",
  "locationText": "Science Block",
  "latitude": null,
  "longitude": null,
  "reportedBy": { "userId": 2, "username": "asha" },
  "assignedResponder": null,
  "createdAt": "2026-11-25T14:32:00Z",
  "updatedAt": "2026-11-25T14:32:02Z",
  "resolvedAt": null
}
```
Errors: 400 `VALIDATION_ERROR`. This endpoint does **not** return 503 because of responder outages (fallback).

### GET /api/incidents  (USER, ADMIN)

USER: own incidents only. ADMIN: all incidents. Optional query `status=PENDING|ASSIGNED|RESOLVED|REPORTED`.
200 -> array of Incident objects.

### GET /api/incidents/{id}  (USER owner, ADMIN)

200 -> Incident. Errors: 403 `FORBIDDEN` (not owner), 404 `NOT_FOUND`.

### POST /api/incidents/{id}/dispatch  (ADMIN)

Retries assignment for a `PENDING` incident. No body.
200 -> Incident (`ASSIGNED`, or still `PENDING` if no responder/service down).
Errors: 403, 404, 409 `INVALID_STATE` (not `PENDING`).

### POST /api/incidents/{id}/resolve  (ADMIN)

No body. Releases the responder and sets `RESOLVED`.
200 -> Incident. Errors: 403, 404, 409 `INVALID_STATE` (not `ASSIGNED`), 503 `SERVICE_UNAVAILABLE` (responder-service down; state unchanged).

## 5. Responder endpoints

### Responder object

```json
{ "id": 1, "name": "Ambulance Alpha", "type": "AMBULANCE", "status": "BUSY", "zone": "North", "currentIncidentId": 11 }
```

### GET /api/responders  (USER, ADMIN)

Optional query `status`, `type`. 200 -> array of Responder objects.

### GET /api/responders/{id}  (USER, ADMIN)

200 -> Responder. 404 `NOT_FOUND`.

### POST /api/responders  (ADMIN)  - Should

Request `{ "name": "Ambulance Delta", "type": "AMBULANCE", "zone": "West" }` -> 201 Responder (`AVAILABLE`). 409 `NAME_TAKEN`.

### PATCH /api/responders/{id}/status  (ADMIN)  - Should

Request `{ "status": "OFFLINE" }` (allowed values `AVAILABLE`, `OFFLINE`).
200 -> Responder. 409 `INVALID_STATE` if responder is `BUSY`. 400 if value is `BUSY`.

## 6. Notification endpoints

### Notification object

```json
{
  "id": 5,
  "userId": 2,
  "incidentId": 11,
  "type": "INCIDENT_ASSIGNED",
  "message": "Incident #11 (MEDICAL, CRITICAL) assigned to Ambulance Alpha.",
  "read": false,
  "createdAt": "2026-11-25T14:30:02Z"
}
```

### GET /api/notifications  (USER, ADMIN)

USER: own notifications. ADMIN: all (add `?mine=true` to see only own). Newest first.
200 -> array.

### PATCH /api/notifications/{id}/read  (USER owner, ADMIN)  - Should

No body. 200 -> Notification with `"read": true`. 403, 404.

## 7. Health endpoints

`GET /actuator/health` on every service (gateway exposes its own publicly at `/actuator/health`).
```json
{ "status": "UP" }
```
Kubernetes probes use `/actuator/health/liveness` and `/actuator/health/readiness`.

## 8. Internal endpoints (service-to-service only, not routed by the gateway)

### POST /internal/responders/assign   (incident-service -> responder-service)

Request
```json
{ "incidentId": 11, "incidentType": "MEDICAL", "severity": "CRITICAL" }
```
200
```json
{ "responderId": 1, "name": "Ambulance Alpha", "type": "AMBULANCE" }
```
409 `NO_RESPONDER_AVAILABLE` when no `AVAILABLE` responder of the mapped type exists.
Idempotent: if the incident already holds a responder, return that responder with 200.

### POST /internal/responders/{id}/release   (incident-service -> responder-service)

Request `{ "incidentId": 11 }`
200 `{ "responderId": 1, "status": "AVAILABLE" }`. Idempotent: already-available responder returns 200.
404 if responder does not exist.

## 9. Events (RabbitMQ)

| Item | Value |
|---|---|
| Exchange | `resqnet.events` (topic, durable) |
| Routing keys | `incident.assigned`, `incident.pending` |
| Queue | `notification.incidents` (durable), binding `incident.*` |
| Producer | incident-service |
| Consumer | notification-service |
| Content type | `application/json` (Jackson message converter on both sides) |
| Delivery | At-least-once; consumer de-duplicates on `eventId` |

Payload (`incident.assigned`)
```json
{
  "eventId": "6f1c2b9e-7e0a-4b0e-9d6a-1d2f3c4b5a69",
  "eventType": "INCIDENT_ASSIGNED",
  "occurredAt": "2026-11-25T14:30:01Z",
  "incidentId": 11,
  "userId": 2,
  "username": "asha",
  "incidentType": "MEDICAL",
  "severity": "CRITICAL",
  "status": "ASSIGNED",
  "responder": { "id": 1, "name": "Ambulance Alpha" }
}
```

Payload (`incident.pending`) - same shape, `"eventType": "INCIDENT_PENDING"`, `"status": "PENDING"`, `"responder": null`.

Consumer behaviour: insert notification using the templates in `docs/schema.md`; on duplicate `eventId`, acknowledge and skip;
on malformed message, log and reject without requeue (stretch: dead-letter queue).

## 10. Role matrix (summary)

| Endpoint | Public | USER | ADMIN |
|---|---|---|---|
| POST /api/auth/register, /login | yes | yes | yes |
| GET /api/auth/me | | yes | yes |
| POST /api/incidents | | yes | yes |
| GET /api/incidents, /{id} | | own only | all |
| POST /api/incidents/{id}/dispatch, /resolve | | no (403) | yes |
| GET /api/responders, /{id} | | yes | yes |
| POST /api/responders, PATCH .../status | | no (403) | yes |
| GET /api/notifications | | own only | all |
| PATCH /api/notifications/{id}/read | | own only | yes |
| GET /actuator/health (gateway) | yes | yes | yes |
| GET /api/ops/health, /resilience, /traffic, /kubernetes | | no (403) | yes |

## 11. Operations API (administrator only, added for the operations command center)

Read-only observability endpoints, **answered by the API gateway itself** (they are not routed to any service, so the routing filter does not run; each handler verifies the JWT with the same secret, issuer and expiry rules). They exist because the browser must not talk to Eureka, the services' actuator endpoints, PostgreSQL, RabbitMQ or Kubernetes. Existing endpoints and contracts above are unchanged.

| Method and path | Auth | Answer |
|---|---|---|
| `GET /api/ops/health` | ADMIN | health of every instance, Eureka registry, databases, RabbitMQ |
| `GET /api/ops/resilience` | ADMIN | circuit-breaker state and recent events of every incident-service instance |
| `GET /api/ops/traffic` | ADMIN | request counters per pod (since the pod started) |
| `GET /api/ops/kubernetes` | ADMIN | deployments, replica counts, pods and service exposure of the namespace `resqnet` |

Errors: no or bad token `401 UNAUTHORIZED`, valid token without ADMIN `403 FORBIDDEN` (standard error body, section 2). Responses carry `Cache-Control: no-store`.

Sources (all live, nothing cached or invented): the Eureka REST registry (`/eureka/apps`), `GET /actuator/health` (component names and UP/DOWN only, `show-details` stays `never`), `/actuator/circuitbreakers`, `/actuator/circuitbreakerevents`, `/actuator/metrics/http.server.requests` of each registered instance, and the Kubernetes API read with the gateway's own read-only ServiceAccount (`k8s/31-gateway-rbac.yaml`: `get`/`list` on deployments, pods and services in `resqnet`, nothing else). The actuator endpoints are reachable only inside the cluster; the gateway has no route to them. Unreadable sources are reported (`UNKNOWN`, `UNREACHABLE`, `"available": false`) and never guessed.

`GET /api/ops/health` (shape, values abbreviated):

```json
{
  "generatedAt": "2026-11-25T13:20:00Z",
  "discovery": { "health": "UP", "registryReadable": true, "responseMs": 45,
                 "registeredApplications": [{ "name": "incident-service", "instances": 2, "up": 2 }] },
  "services": [{ "name": "incident-service", "status": "UP", "registeredInstances": 2, "healthyInstances": 2,
                 "lastHealthyAt": "2026-11-25T13:20:00Z",
                 "instances": [{ "instanceId": "...", "address": "10.244.0.142:8082", "eurekaStatus": "UP",
                                 "health": "UP", "responseMs": 382, "components": { "db": "UP", "rabbit": "UP" } }] }],
  "databases": [{ "service": "incident-service", "database": "incident_db", "status": "UP" }],
  "rabbitmq": { "status": "UP", "reportedBy": [{ "service": "incident-service", "role": "publishes incident events", "status": "UP" }] }
}
```

Service `status`: `UP` (all registered instances healthy), `DEGRADED` (some), `DOWN` (none healthy, or none registered), `UNKNOWN` (the registry could not be read). A database or the broker is `UP` if any reporting instance says so, `DOWN` if instances report it but none is UP, `UNKNOWN` if nobody reports it (for example because its service is down).

`GET /api/ops/resilience`: `{ "instances": [{ "instanceId", "available", "circuitBreakers": { "responderService": { "state", "failureRate", "bufferedCalls", "failedCalls", "notPermittedCalls", ... } }, "events": [{ "type", "stateTransition", "time", "errorMessage" }] }] }` (newest event first, at most 15).

`GET /api/ops/traffic`: `{ "instances": [{ "service", "instanceId", "available", "requests": { "/incidents": 8, "/incidents/{id}": 0 } }] }`. Counts are Micrometer `http.server.requests` by URI template since the pod started.

`GET /api/ops/kubernetes`: `{ "namespace", "available", "reason"?, "deployments": [{ "name", "desired", "ready", "available", "updated", "image" }], "pods": [{ "name", "app", "phase", "ready", "restarts", "startedAt", "terminating" }], "services": [{ "name", "type", "ports": [{ "port", "nodePort"? }] }] }`. Outside a cluster the answer is `{ "available": false, "reason": "..." }`.

# API Contract - ResQNet Lite

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

### Identity headers (gateway -> services, never from clients)

`X-User-Id`, `X-User-Name`, `X-User-Role`. See `docs/AUTHENTICATION.md`.

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

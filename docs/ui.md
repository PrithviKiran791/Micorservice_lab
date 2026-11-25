# UI - ResQNet Lite

## 1. Decision

The rubric grades deployment, databases, communication, resilience and gateway security.
It does **not** grade a user interface. Therefore:

| Level | What | Priority |
|---|---|---|
| L1 | **Postman collection** is the demo client | **Must** |
| L2 | Single static HTML page served by the gateway | Could (only after all MVP items and the demo rehearsal are done) |

Do not start L2 until `docs/tracker.md` shows every Must item finished.

## 2. L1 - Postman collection (`postman/ResQNet-Lite.postman_collection.json`)

### Variables

| Variable | Value |
|---|---|
| `baseUrl` | `http://localhost:8080` |
| `userToken` | set automatically by the Login (user) test script |
| `adminToken` | set automatically by the Login (admin) test script |
| `incidentId` | set automatically after creating an incident |

### Folder structure (in demo order)

1. **0 - Health**: `GET {{baseUrl}}/actuator/health`
2. **1 - Security**
   - Incidents without token (expect 401)
   - Incidents with garbage token (expect 401)
3. **2 - Auth**
   - Register user `asha`
   - Login user -> stores `userToken`
   - Login admin (`admin` / `Admin@123`) -> stores `adminToken`
   - Me
4. **3 - Incidents**
   - Report MEDICAL / CRITICAL (expect `ASSIGNED`) -> stores `incidentId`
   - Report FIRE / MEDIUM
   - List my incidents
   - Admin: list all incidents
   - Admin: dispatch `{{incidentId}}` (for the PENDING demo)
   - Admin: resolve `{{incidentId}}`
   - USER tries dispatch (expect 403)
5. **4 - Notifications**: list, mark read
6. **5 - Responders**: list all, list `status=AVAILABLE`, set OFFLINE/AVAILABLE (admin)
7. **6 - Resilience demo**: report incident while responder-service is scaled to 0 (expect `PENDING`), list responders (expect 503)

### Auth handling

Collection-level authorization is set to Bearer with `{{userToken}}`; admin requests override it with `{{adminToken}}`.
Login requests have a **Tests** script:

```javascript
const body = pm.response.json();
pm.collectionVariables.set("userToken", body.token);   // use adminToken in the admin login request
```

Report-incident tests script:

```javascript
const body = pm.response.json();
pm.collectionVariables.set("incidentId", body.id);
pm.test("created", () => pm.response.to.have.status(201));
pm.test("has status", () => pm.expect(["ASSIGNED","PENDING"]).to.include(body.status));
```

Each request carries 1-2 simple status-code tests so the Collection Runner shows a green/red result during the demo.

### Sample request bodies

Register / login
```json
{ "username": "asha", "password": "Pass@1234" }
```
Report incident
```json
{ "type": "MEDICAL", "severity": "CRITICAL", "description": "Person collapsed near library",
  "locationText": "Main Library, Gate 2" }
```

## 3. L2 - Optional static demo page

### Goal

Let the class open one URL, log in, report an incident and watch its status change, while the presenter shows
a dispatcher view. It only calls existing `/api/**` endpoints; no new backend work.

### Hosting

Plain files in `api-gateway/src/main/resources/static/` (`index.html`, `app.js`, `styles.css`), served by the gateway
on the same origin, so no CORS configuration is needed. These paths are public in the gateway filter.
If the gateway does not serve static files in your Spring Cloud version, fallback: run
`python -m http.server 5500` in the folder and enable CORS for `http://localhost:5500` on the gateway - or skip L2.

### Technology

Vanilla HTML + CSS + JavaScript (`fetch`), no framework, no build step, under ~300 lines in total.
Token stored in `sessionStorage`. Poll every 3 seconds while a view is visible.

### Screens

**S1 - Login / Register**
```text
+------------------------------------------+
|  ResQNet Lite                            |
|  Username  [______________]              |
|  Password  [______________]              |
|  [ Login ]   [ Register ]                |
|  (error message area)                    |
+------------------------------------------+
```
Calls: `POST /api/auth/login`, `POST /api/auth/register`. On success go to S2 (USER) or S3 (ADMIN).

**S2 - Reporter view**
```text
+-----------------------------------------------------------+
| ResQNet Lite            asha (USER)              [Logout] |
|-----------------------------------------------------------|
| Report emergency                                          |
| Type [MEDICAL v]  Severity [CRITICAL v]                   |
| Description [______________________________]              |
| Location    [______________________________]              |
| [ Report ]                                                |
|-----------------------------------------------------------|
| My incidents                                              |
| #11  MEDICAL  CRITICAL  [ASSIGNED]  Ambulance Alpha       |
| #12  FIRE     MEDIUM    [PENDING ]  waiting for responder |
|-----------------------------------------------------------|
| Notifications                                             |
| * Incident #11 (MEDICAL, CRITICAL) assigned to ...        |
+-----------------------------------------------------------+
```
Calls: `POST /api/incidents`, `GET /api/incidents`, `GET /api/notifications`.

**S3 - Dispatcher view (ADMIN)**
```text
+-----------------------------------------------------------+
| ResQNet Lite            admin (ADMIN)            [Logout] |
|  [!] Responder service unavailable   <- banner on 503     |
|-----------------------------------------------------------|
| Incidents (all)           Filter [ALL v]                  |
| #12 FIRE   MEDIUM   PENDING   asha   [Dispatch]           |
| #11 MEDICAL CRITICAL ASSIGNED asha   Ambulance Alpha [Resolve] |
|-----------------------------------------------------------|
| Responders                                                |
| Ambulance Alpha  AMBULANCE  BUSY (#11)                    |
| Ambulance Bravo  AMBULANCE  AVAILABLE                     |
+-----------------------------------------------------------+
```
Calls: `GET /api/incidents`, `POST /api/incidents/{id}/dispatch`, `POST /api/incidents/{id}/resolve`, `GET /api/responders`.

### UI behaviour rules

| Situation | Behaviour |
|---|---|
| Any 401 | Clear token, return to S1 with "Session expired" |
| 403 | Show "Not allowed" toast |
| 503 on `/api/responders` | Show red banner "Responder service unavailable"; keep the rest of the page working (this is the resilience demo visual) |
| 400 validation | Show field messages from `details` under the form |
| `PENDING` status | Amber badge; text "Waiting for a responder" |
| `ASSIGNED` | Green badge with responder name |
| `RESOLVED` | Grey badge |
| `REPORTED` | Blue badge (rarely visible) |
| Empty lists | "Nothing here yet" |

### Visual style

Simple and readable on a projector: system font, 16-18 px base size, high contrast, one accent colour,
status badges with both colour and text (never colour only). Works on a phone width (single column).

### Acceptance criteria (L2)

- Login, report incident, see status and notification without using Postman.
- Admin can dispatch a `PENDING` incident and resolve an `ASSIGNED` one.
- Banner appears when responder-service is scaled to 0 and disappears after it returns.
- No console errors during a full run-through.

## 4. Out of scope for UI

Maps, charts, WebSockets/SSE, frameworks (React/Angular), authentication cookies, i18n, animations.

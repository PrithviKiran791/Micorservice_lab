# Authentication and Authorization - AegisFlow

Rubric requirement: **authentication is checked at the gateway.**
Design: auth-service issues a signed JWT; the API Gateway validates it on every non-public request
and passes the verified identity to services through trusted headers.

## 1. Flow

```text
1. Client -> Gateway -> auth-service : POST /api/auth/login  (public)
2. auth-service verifies BCrypt password, returns JWT
3. Client -> Gateway : any request with  Authorization: Bearer <jwt>
4. Gateway (GlobalFilter):
     a. is path public?            -> forward untouched (identity headers still stripped)
     b. parse + verify signature, issuer, expiry
     c. invalid/missing            -> 401 JSON, request never reaches a service
     d. valid                      -> remove client X-User-* headers, add trusted X-User-* headers, forward
5. Service reads X-User-Id / X-User-Name / X-User-Role and enforces role rules
```

## 2. Token

| Property | Value |
|---|---|
| Type | JWT, JWS compact serialization |
| Algorithm | HS256 (shared secret) |
| Library | jjwt 0.12.x |
| Issuer (`iss`) | `resqnet-auth` (env `JWT_ISSUER`) |
| Subject (`sub`) | user id as string, e.g. `"2"` |
| Custom claims | `username` (string), `role` (`USER` or `ADMIN`) |
| Issued at (`iat`) / Expiry (`exp`) | Expiry from `JWT_EXPIRY_MINUTES`, default **120** (long enough for the demo) |
| Secret | env `JWT_SECRET`, at least 32 characters (256 bits); same value in auth-service and gateway |
| Transport | `Authorization: Bearer <token>` header only (no cookies, no query string) |

Example payload
```json
{ "iss": "resqnet-auth", "sub": "2", "username": "asha", "role": "USER",
  "iat": 1764081000, "exp": 1764088200 }
```

## 3. Public routes (no token required)

| Method | Path |
|---|---|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| GET | `/actuator/health`, `/actuator/health/**` (gateway's own) |
| GET | Static demo page assets (`/`, `/index.html`, `/app.js`, `/styles.css`) - only if the optional UI is built |

Everything else requires a valid token. `OPTIONS` pre-flight is allowed only if CORS is configured (not needed when the UI is served by the gateway).

## 4. Header contract (gateway -> services)

| Header | Value | Source |
|---|---|---|
| `X-User-Id` | `sub` claim | JWT |
| `X-User-Name` | `username` claim | JWT |
| `X-User-Role` | `role` claim | JWT |

The gateway **always removes** any inbound `X-User-Id`, `X-User-Name`, `X-User-Role` before adding its own,
including on public routes. Services must treat these headers as the only identity source and must not accept
identity from request bodies or parameters.

## 5. Gateway filter specification

Implement a `GlobalFilter` with `Ordered.HIGHEST_PRECEDENCE` (class name suggestion `JwtAuthenticationFilter`):

1. Build a mutated request that has the three `X-User-*` headers removed.
2. If method + path match the public list, continue the chain with the mutated request.
3. Read `Authorization`. If absent or not prefixed `Bearer `, respond 401.
4. Parse with `Jwts.parser().verifyWith(key).requireIssuer(issuer).build().parseSignedClaims(token)`.
   Any `JwtException` (bad signature, expired, malformed) -> 401.
5. Require `sub`, `username`, `role` claims and `role` in {`USER`,`ADMIN`}; otherwise 401.
6. Add `X-User-Id`, `X-User-Name`, `X-User-Role` and continue the chain.

401 response (written directly by the filter, `Content-Type: application/json`):
```json
{ "timestamp": "2026-11-25T14:30:00Z", "status": 401, "error": "Unauthorized",
  "code": "UNAUTHORIZED", "message": "Missing or invalid token", "path": "/api/incidents" }
```
Do not leak the reason (expired vs bad signature) to clients; log it server-side.

Optional hardening at the gateway: block `/internal/**` with 404 even though no route exists.

## 6. Service-side authorization

Each business service reads the identity headers (a small filter or `@RequestHeader`) and applies role rules.
Keep it simple: a helper such as `CurrentUser { id, username, role }` and methods `requireAdmin()` / `requireOwnerOrAdmin(ownerId)`.

Failures return 403 with code `FORBIDDEN`.

### Role matrix

| Endpoint | Public | USER | ADMIN |
|---|---|---|---|
| POST /api/auth/register, /login | yes | yes | yes |
| GET /api/auth/me | | yes | yes |
| POST /api/incidents | | yes | yes |
| GET /api/incidents | | own only | all |
| GET /api/incidents/{id} | | owner only | yes |
| POST /api/incidents/{id}/dispatch | | 403 | yes |
| POST /api/incidents/{id}/resolve | | 403 | yes |
| GET /api/responders, /{id} | | yes | yes |
| POST /api/responders | | 403 | yes |
| PATCH /api/responders/{id}/status | | 403 | yes |
| GET /api/notifications | | own only | all |
| PATCH /api/notifications/{id}/read | | owner only | yes |
| GET /api/ops/health, /resilience, /traffic, /kubernetes | | 403 | yes (answered by the gateway itself, see API_CONTRACT section 11) |

Internal endpoints (`/internal/**`) carry no user identity and are protected by network isolation (ClusterIP, not routed).

## 7. Passwords and registration

- BCrypt via `BCryptPasswordEncoder` (strength 10). Never log or return password hashes.
- Public registration always creates role `USER`; the role field is ignored if sent.
- One `ADMIN` is seeded on startup if missing: `admin` / `Admin@123` (development/demo only).
- Login failure message is identical for unknown user and wrong password (`INVALID_CREDENTIALS`).

## 8. Secrets in Kubernetes

| Secret key | Used by |
|---|---|
| `JWT_SECRET` | auth-service, api-gateway (same value) |
| `AUTH_DB_PASSWORD`, `INCIDENT_DB_PASSWORD`, `RESPONDER_DB_PASSWORD`, `NOTIFICATION_DB_PASSWORD` | Postgres init + matching service |
| `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS` | RabbitMQ, incident-service, notification-service |

Create them in `k8s/01-secrets.yaml` as `stringData` for the lab. For anything beyond the lab, generate real values and keep them out of Git.

## 9. Threats and mitigations

| Threat | Mitigation |
|---|---|
| Client forges `X-User-Role: ADMIN` | Gateway strips inbound identity headers on every request |
| Direct call to a service bypassing the gateway | Services are `ClusterIP`; only the gateway is exposed |
| Abuse of assign/release | `/internal/**` not routed; optional NetworkPolicy |
| Stolen token | Short-ish expiry, HTTPS in real deployments (out of scope in lab) |
| Weak/leaked JWT secret | 32+ char secret in a Kubernetes Secret, same value only in auth + gateway |
| Brute-force login | Out of scope for MVP (note as future: rate limiting, lockout) |
| Information leakage in errors | Generic 401/INVALID_CREDENTIALS messages |
| Password disclosure | BCrypt hashes only; no password in logs or responses |

## 10. Implementation notes

- Gateway dependencies: `spring-cloud-starter-gateway` (reactive variant generated by start.spring.io), `io.jsonwebtoken:jjwt-api`, `jjwt-impl`, `jjwt-jackson` (runtime).
- auth-service: prefer `spring-security-crypto` (BCrypt only). If `spring-boot-starter-security` is used, add a `SecurityFilterChain` that permits all requests and disables CSRF, otherwise all endpoints return 401/403.
- Signing key: `Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))`; fail fast at startup if the secret is shorter than 32 bytes.
- Business services do **not** validate JWTs; they only read headers. Do not add Spring Security to them.
- Clock: tokens use server time; Kubernetes pods share the node clock, so no skew handling is needed.

## 11. Test checklist (also used for the demo)

| # | Request | Expected |
|---|---|---|
| 1 | `GET /api/incidents` with no token | 401 `UNAUTHORIZED` (gateway) |
| 2 | `GET /api/incidents` with garbage token | 401 |
| 3 | Token signed with a different secret | 401 |
| 4 | Expired token (set expiry to 1 minute temporarily) | 401 |
| 5 | Register then login | 201 then 200 with token |
| 6 | `POST /api/incidents` with valid token | 201 |
| 7 | USER token on `POST /api/incidents/{id}/dispatch` | 403 `FORBIDDEN` |
| 8 | Valid USER token + forged `X-User-Role: ADMIN` header on an admin endpoint | 403 (forged header ignored) |
| 9 | USER reads another user's incident by id | 403 |
| 10 | Direct access to `/internal/responders/assign` through the gateway | 404 (not routed) |

## 12. Known limitations

No refresh tokens, no revocation list, no HTTPS inside the lab cluster, no rate limiting, symmetric key shared by two services.
These are acceptable for the lab and listed as future work.

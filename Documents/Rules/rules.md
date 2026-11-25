# Rules - ResQNet Lite

Normative rules for everyone (and every AI agent) working on this project.
**MUST / MUST NOT** are mandatory. **SHOULD** is expected unless there is a stated reason.
Rule ids (for example `R-DB-2`) can be cited in commits and reviews.

## 1. Scope rules

- **R-SC-1** Work is judged against the 20-mark rubric (Deployment 5, Database 4, Communication 4, Resilience 4, Security 3). Every task MUST map to a rubric row, the demo, or a documented requirement.
- **R-SC-2** MVP before stretch. Stretch items (see `docs/PRD.md` section 9) MUST NOT start until every MVP item in `docs/tracker.md` is checked and the demo has been rehearsed once.
- **R-SC-3** The **cut list** is closed unless approved: Redis, WebSockets/SSE, Kafka, Prometheus/Grafana, HPA/autoscaling, Ingress controller, public cloud hosting, maps, payment/SMS/email, React/Angular, OAuth.
- **R-SC-4** New services, databases, dependencies, endpoints or events MUST be added to the contract/schema docs first (or in the same commit).
- **R-SC-5** Prefer boring and working over clever and unfinished.

## 2. Architecture rules

- **R-AR-1** One service = one database = one DB user. A service MUST NOT connect to another service's database.
- **R-AR-2** Services MUST NOT share entity classes, DTO classes, or a common domain library. Duplicate small DTOs instead.
- **R-AR-3** Allowed inter-service calls are exactly: incident -> responder (sync REST) and incident -> notification (async event via RabbitMQ). Anything else needs approval.
- **R-AR-4** All external traffic MUST enter through the gateway. Business services MUST be `ClusterIP`.
- **R-AR-5** `/internal/**` endpoints MUST NOT be routed by the gateway nor exposed by NodePort/Ingress.
- **R-AR-6** Service discovery is Kubernetes DNS (`http://responder-service:8083`). No Eureka, no hard-coded IPs.
- **R-AR-7** Remote calls MUST NOT run inside an open database transaction. Save and commit, call, then update.

## 3. Coding rules

- **R-CD-1** Java 17, Maven, Spring Boot 3.x. Package root `com.resqnet.<service>`.
- **R-CD-2** Layering: `controller` (HTTP only) -> `service` (business logic) -> `repository` (data). Controllers MUST NOT contain business logic or call repositories directly.
- **R-CD-3** Entities MUST NOT be returned from controllers. Use request/response DTOs (records are fine).
- **R-CD-4** Input MUST be validated with Bean Validation (`@Valid`, `@NotBlank`, `@Size`, enums). Return the standard error body.
- **R-CD-5** A global `@RestControllerAdvice` maps exceptions to the error format in `docs/API_CONTRACT.md`. No stack traces in responses.
- **R-CD-6** Use constructor injection. Lombok is allowed for getters/setters/builders; avoid `@Data` on JPA entities.
- **R-CD-7** No magic strings for enums or status values; use Java enums stored with `@Enumerated(EnumType.STRING)`.
- **R-CD-8** Time is `Instant` / `OffsetDateTime` in UTC. No `Date`.
- **R-CD-9** No `System.out.println`; use SLF4J. Log ids, not personal data. Never log passwords, tokens or the JWT secret.
- **R-CD-10** Keep methods short and names explicit. Comment the *why* of non-obvious logic (locking, fallback, idempotency).

## 4. API rules

- **R-API-1** `docs/API_CONTRACT.md` is authoritative. Paths, field names, status codes and error codes MUST match it exactly.
- **R-API-2** Create returns 201; reads return 200; validation 400; unauthenticated 401; forbidden 403; missing 404; state conflicts 409; downstream unavailable 503.
- **R-API-3** `POST /api/incidents` MUST succeed (201) even when responder-service is down; it returns status `PENDING`.
- **R-API-4** Responses MUST be JSON with consistent field naming (camelCase).

## 5. Database rules

- **R-DB-1** Schema MUST match `docs/schema.md`. Use `ddl-auto=update` during development only; never `create-drop` in Kubernetes.
- **R-DB-2** Responder assignment MUST be atomic: `SELECT ... FOR UPDATE SKIP LOCKED` (or an equivalent single-statement update) inside one transaction, and idempotent per `incidentId`.
- **R-DB-3** Cross-service ids are plain columns; no cross-database foreign keys or joins.
- **R-DB-4** DB credentials MUST come from environment variables / Kubernetes Secret, one user per database.
- **R-DB-5** Seed data (admin user, responders) MUST be inserted only when missing, so restarts do not duplicate it.

## 6. Messaging rules

- **R-MQ-1** Exchange `resqnet.events` (topic, durable), routing keys `incident.assigned` / `incident.pending`, queue `notification.incidents` (durable).
- **R-MQ-2** Payload MUST follow the event schema in `docs/API_CONTRACT.md`, JSON via Jackson converter.
- **R-MQ-3** Consumers MUST be idempotent (unique `event_id`). Duplicates are acknowledged and skipped.
- **R-MQ-4** A failed publish MUST NOT fail the incident request; log at ERROR with the incident id.
- **R-MQ-5** Declare exchange/queue/binding in code (`@Bean` declarables) on both sides so start-up order does not matter.

## 7. Resilience rules

- **R-RS-1** The incident -> responder call MUST have connect timeout <= 1 s, read timeout <= 2 s, a Resilience4j circuit breaker and a fallback to `PENDING`.
- **R-RS-2** A business `409 NO_RESPONDER_AVAILABLE` MUST NOT count as a circuit-breaker failure but MUST result in `PENDING`.
- **R-RS-3** Other endpoints (login, list incidents, notifications) MUST NOT depend on responder-service being up.
- **R-RS-4** Every pod MUST define liveness and readiness probes via Actuator; readiness MUST NOT be `UP` until the DB (and broker, where used) is reachable.
- **R-RS-5** Retries only for idempotent calls; at most one retry for assign.

## 8. Security rules

- **R-SE-1** JWT validation happens in the gateway only. Business services MUST NOT parse JWTs.
- **R-SE-2** The gateway MUST strip inbound `X-User-*` headers and set verified ones on every request.
- **R-SE-3** Public routes are limited to register, login, gateway health (and optional static UI). Everything else needs a valid token.
- **R-SE-4** Services MUST read identity only from `X-User-*` headers, never from body/query.
- **R-SE-5** Passwords MUST be hashed with BCrypt. Public registration creates `USER` only.
- **R-SE-6** `JWT_SECRET` MUST be at least 32 characters, supplied via Secret/env, never defaulted in code for Kubernetes.
- **R-SE-7** Error messages for auth failures MUST be generic.

## 9. Kubernetes and Docker rules

- **R-K8-1** Everything lives in namespace `resqnet`; manifests live in `k8s/`, one file per concern, numbered for apply order.
- **R-K8-2** Image names: `resqnet/<service>:1.0`; `imagePullPolicy: IfNotPresent`; images built with Minikube's Docker daemon (`minikube docker-env`).
- **R-K8-3** Every Deployment MUST have resource requests/limits, probes, and configuration from env/ConfigMap/Secret. No hard-coded URLs in images.
- **R-K8-4** Only `api-gateway` is exposed (NodePort 30080 or port-forward). Postgres/RabbitMQ/services are `ClusterIP`.
- **R-K8-5** Dockerfiles MUST be minimal: `eclipse-temurin:17-jre`, copy the built jar, run it. Build the jar with Maven before building the image.
- **R-K8-6** JVM memory MUST be capped (`-XX:MaxRAMPercentage=70` and container limit ~512Mi) so the whole stack fits in 4 GB.
- **R-K8-7** The resilience demo uses `kubectl scale deploy/responder-service --replicas=0/1`; do not delete the Deployment.

## 10. Git rules

- **R-GT-1** Commit small, working steps. Message format: `type(scope): summary` (`feat(gateway): add JWT filter`, `fix(responder): lock row on assign`, `docs: update API contract`).
- **R-GT-2** `.gitignore` MUST exclude `target/`, `.idea/`, `*.iml`, `.vscode/`, `.env`, `*.log`.
- **R-GT-3** Never commit real secrets. The lab secrets in `k8s/01-secrets.yaml` are demo values and MUST be labelled as such.
- **R-GT-4** Docs change in the same commit as the behaviour they describe.

## 11. Testing rules

- **R-TS-1** Minimum automated tests: one service-level test for assignment (no double assignment), one for the fallback to `PENDING`, one for JWT filter accept/reject. More only if time remains.
- **R-TS-2** The Postman collection MUST cover every demo step, with status-code assertions.
- **R-TS-3** Before the presentation, run the full demo script twice from a clean `kubectl delete ns resqnet` + `kubectl apply -f k8s/`.

## 12. Definition of done (per task)

1. Builds (`mvn clean package`) and starts.
2. Behaviour matches `docs/API_CONTRACT.md` and `docs/AUTHENTICATION.md`.
3. Verified manually (Postman or `curl.exe`), and in Kubernetes if the task is a deployment item.
4. No rule above is violated.
5. Docs updated if behaviour changed; `docs/tracker.md` ticked and logged.

## 13. When in doubt

Choose the option that is simpler, keeps services independent, and is easiest to explain in two sentences to the examiner.

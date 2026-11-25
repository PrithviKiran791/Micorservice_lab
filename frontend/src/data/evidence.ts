// RECORDED EVIDENCE: results that were produced earlier and are stored in the repository.
// Nothing here is measured by the running page. Every item names the file it comes from, so it can be checked.
// The Lab Evaluation page always labels these as "Recorded evidence" and never mixes them with live values.

export interface EvidenceItem {
  /** What was done. */
  what: string
  /** The recorded result, copied from the source file. */
  result: string
  /** File in the repository that contains the proof. */
  source: string
  date: string
}

export const REHEARSAL: EvidenceItem[] = [
  { what: 'Clean-cluster rehearsal (deploy, smoke, resilience, failover, Postman, load, references)', result: 'REHEARSAL PASSED, 10 pods, 0 restarts', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' },
  { what: 'Smoke test through the gateway (health, security, register/login, incident, event, roles, validation)', result: '37 passed, 0 failed', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' },
  { what: 'Resilience demo (responder-service scaled to 0 and back)', result: '16 passed, 0 failed', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' },
  { what: 'Failover demo (one incident-service pod deleted under traffic)', result: '7 passed, 0 failed; all 111 requests answered HTTP 200', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' },
  { what: 'Postman collection run with newman', result: '43 assertions, 0 failed', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' },
]

export const LOAD_TEST = {
  source: 'docs/evidence/rehearsal-run5-10pods.txt',
  date: '25 Nov 2026',
  command: '.\\scripts\\load-test.ps1',
  summary: [
    ['Workload', '20 users x 25 rounds x 3 endpoints'],
    ['Total requests', '1500'],
    ['Duration', '11.3 s (133 requests/second)'],
    ['Latency', 'avg 146 ms, p95 294 ms, max 693 ms'],
    ['HTTP status counts', '200 x 1500'],
  ] as [string, string][],
  distribution: [
    { pod: 'incident-service-7784d44bbd-ff6pv', requests: 249, share: 50 },
    { pod: 'incident-service-7784d44bbd-qvl6s', requests: 251, share: 50 },
  ],
  note: 'Pod names are those of the pods that existed during the recorded run.',
}

export const FAILOVER = {
  source: 'docs/evidence/failover-before-retry.txt, docs/evidence/failover-after-retry.txt',
  before: 'Before the gateway retry: 9 of 32 requests failed while a pod was deleted (eight 503 and one 30 s hang).',
  after: 'After the retry was added: 0 of 114 requests failed, slowest 1.08 s.',
}

export interface TestRow {
  suite: string
  tests: number | null
  result: string
  covers: string
  source: string
}

export const UNIT_TESTS: TestRow[] = [
  { suite: 'auth-service', tests: 5, result: 'PASS', covers: 'duplicate username 409, role always USER, only the BCrypt hash stored, same 401 for wrong password and unknown user', source: 'docs/evidence/unit-tests-auth-service.txt' },
  { suite: 'api-gateway', tests: 30, result: 'PASS', covers: 'JWT checks (missing, garbage, expired, wrong secret, wrong issuer, unknown role), forged headers replaced, GET retry on a dead copy, web UI route (7 tests), operations API: 401/403, real states, no secrets leaked (9 tests)', source: 'docs/evidence/unit-tests-api-gateway.txt' },
  { suite: 'responder-service (real PostgreSQL, Testcontainers)', tests: 4, result: 'PASS', covers: '10 simultaneous assignments for 3 ambulances give exactly 3 responders (row lock), assign is idempotent', source: 'docs/evidence/unit-tests-responder-service.txt' },
  { suite: 'incident-service (real PostgreSQL, real circuit breaker)', tests: 19, result: 'PASS', covers: '409, refused, timeout and HTTP 500 all give PENDING quickly; 3 failures open the breaker and nothing reaches the responder while it is open; USER gets 403 on admin endpoints; events published and a broker failure never fails the request', source: 'docs/evidence/unit-tests-incident-service.txt' },
  { suite: 'notification-service (real PostgreSQL)', tests: 9, result: 'PASS', covers: 'templates, duplicate eventId creates one notification, malformed events rejected', source: 'docs/evidence/unit-tests-notification-service.txt' },
  { suite: 'discovery-service', tests: 0, result: '-', covers: 'no application logic of its own (Eureka); verified through the cluster tests', source: 'docs/evidence/unit-tests-discovery-service.txt' },
]

export const TESTS_ADDED_LATER = [
  'Total JUnit tests when last run on 25 Nov 2026: 67 (the logs above are from that run). frontend: 57 unit tests (Vitest), not part of those logs.',
  'Details and exact commands: docs/TEST_REPORT.md (sections A1 and A5).',
]

export const OTHER_TESTING: EvidenceItem[] = [
  { what: 'Integration: smoke test through the real gateway against the real services, database and RabbitMQ', result: '37 passed, 0 failed', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' },
  { what: 'API testing: Postman collection (newman)', result: '43 assertions, 0 failed', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' },
  { what: 'Load testing: 20 parallel users', result: '1500 requests, all HTTP 200', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' },
  { what: 'Resilience testing: responder-service down and back', result: '16 passed, 0 failed', source: 'docs/evidence/rehearsal-run5-10pods.txt', date: '25 Nov 2026' },
]

export const DATABASE_ISOLATION: EvidenceItem = {
  what: 'incident_user tries to open auth_db',
  result: 'refused: permission denied for database "auth_db" (no CONNECT privilege)',
  source: 'docs/TEST_REPORT.md (A2)',
  date: '25 Nov 2026',
}

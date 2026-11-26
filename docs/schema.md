# Schema - AegisFlow

Four PostgreSQL databases on one server, one DB user per service. No foreign keys across databases;
cross-service references are plain ids validated through APIs/events.

| Database | DB user | Owner service |
|---|---|---|
| `auth_db` | `auth_user` | auth-service |
| `incident_db` | `incident_user` | incident-service |
| `responder_db` | `responder_user` | responder-service |
| `notification_db` | `notification_user` | notification-service |

Each user is granted privileges **only** on its own database (`REVOKE CONNECT ... FROM PUBLIC`,
then `GRANT ALL ON DATABASE ... TO <user>`). Passwords come from a Kubernetes Secret / env vars.

Hibernate `ddl-auto=update` creates tables from entities in the MVP; the SQL below is the target
definition the entities must match (use it as reference, or run it as an init script).

## 1. Enumerations (stored as VARCHAR, validated in code and by CHECK)

| Enum | Values |
|---|---|
| `Role` | `USER`, `ADMIN` |
| `IncidentType` | `MEDICAL`, `FIRE`, `POLICE` |
| `Severity` | `LOW`, `MEDIUM`, `CRITICAL` |
| `IncidentStatus` | `REPORTED`, `ASSIGNED`, `PENDING`, `RESOLVED` |
| `ResponderType` | `AMBULANCE`, `FIRE_TRUCK`, `POLICE` |
| `ResponderStatus` | `AVAILABLE`, `BUSY`, `OFFLINE` |
| `NotificationType` | `INCIDENT_ASSIGNED`, `INCIDENT_PENDING` |

Type mapping used for assignment: `MEDICAL -> AMBULANCE`, `FIRE -> FIRE_TRUCK`, `POLICE -> POLICE`.

## 2. auth_db

```sql
CREATE TABLE users (
    id             BIGSERIAL PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,              -- BCrypt
    role           VARCHAR(10)  NOT NULL CHECK (role IN ('USER','ADMIN')),
    enabled        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

Seed (application start, only if missing): `admin` / `Admin@123`, role `ADMIN` (development only; change before any real use).

## 3. incident_db

```sql
CREATE TABLE incidents (
    id                       BIGSERIAL PRIMARY KEY,
    incident_type            VARCHAR(10)  NOT NULL CHECK (incident_type IN ('MEDICAL','FIRE','POLICE')),
    severity                 VARCHAR(10)  NOT NULL CHECK (severity IN ('LOW','MEDIUM','CRITICAL')),
    status                   VARCHAR(10)  NOT NULL CHECK (status IN ('REPORTED','ASSIGNED','PENDING','RESOLVED')),
    description              VARCHAR(500) NOT NULL,
    location_text            VARCHAR(200) NOT NULL,
    latitude                 NUMERIC(9,6),
    longitude                NUMERIC(9,6),
    reported_by_user_id      BIGINT       NOT NULL,     -- logical ref to auth_db.users.id
    reported_by_username     VARCHAR(50)  NOT NULL,
    assigned_responder_id    BIGINT,                    -- logical ref to responder_db.responders.id
    assigned_responder_name  VARCHAR(100),
    assigned_responder_type  VARCHAR(15),               -- AMBULANCE | FIRE_TRUCK | POLICE (API contract shows it)
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resolved_at              TIMESTAMPTZ
);

CREATE INDEX idx_incidents_status   ON incidents (status);
CREATE INDEX idx_incidents_reporter ON incidents (reported_by_user_id);
CREATE INDEX idx_incidents_created  ON incidents (created_at DESC);
```

Why denormalised names: the incident must remain readable when auth/responder services are down.

### Incident state machine

```text
          create
            |
        REPORTED  (transient, same request)
         /     \
 assign OK     no responder / service down
     |               |
  ASSIGNED  <----  PENDING
     |        dispatch (admin retry) succeeds
  resolve (admin)
     |
  RESOLVED
```

| From | To | Trigger |
|---|---|---|
| (new) | `REPORTED` | Incident saved |
| `REPORTED` | `ASSIGNED` | Responder assigned |
| `REPORTED` | `PENDING` | 409 no responder, timeout, connection error, open breaker |
| `PENDING` | `ASSIGNED` | Admin dispatch (or scheduler) succeeds |
| `ASSIGNED` | `RESOLVED` | Admin resolve (responder released) |

Any other transition is invalid -> HTTP 409 `INVALID_STATE`.

## 4. responder_db

```sql
CREATE TABLE responders (
    id                   BIGSERIAL PRIMARY KEY,
    name                 VARCHAR(100) NOT NULL UNIQUE,
    responder_type       VARCHAR(15)  NOT NULL CHECK (responder_type IN ('AMBULANCE','FIRE_TRUCK','POLICE')),
    status               VARCHAR(10)  NOT NULL CHECK (status IN ('AVAILABLE','BUSY','OFFLINE')),
    zone                 VARCHAR(50),
    current_incident_id  BIGINT,                         -- logical ref to incident_db.incidents.id
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_busy_has_incident CHECK (
        (status = 'BUSY' AND current_incident_id IS NOT NULL) OR
        (status <> 'BUSY' AND current_incident_id IS NULL)
    )
);

CREATE INDEX idx_responders_type_status ON responders (responder_type, status);
CREATE UNIQUE INDEX uq_responder_current_incident
    ON responders (current_incident_id) WHERE current_incident_id IS NOT NULL;
```

The partial unique index guarantees one incident can never hold two responders; the CHECK keeps status and incident consistent.

### Assignment query (atomic)

```sql
-- inside one @Transactional method
SELECT * FROM responders
WHERE responder_type = :type AND status = 'AVAILABLE'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;
-- then UPDATE the row: status='BUSY', current_incident_id=:incidentId, updated_at=now()
```

Idempotency: first check `SELECT ... WHERE current_incident_id = :incidentId`; if found, return it without changing anything.

### Responder state machine

```text
AVAILABLE --assign--> BUSY --release--> AVAILABLE
AVAILABLE --admin--> OFFLINE --admin--> AVAILABLE
(BUSY cannot be set manually and cannot go OFFLINE directly)
```

### Seed data (inserted at startup if table empty)

| name | type | zone |
|---|---|---|
| Ambulance Alpha | AMBULANCE | North |
| Ambulance Bravo | AMBULANCE | South |
| Ambulance Charlie | AMBULANCE | East |
| Fire Truck One | FIRE_TRUCK | North |
| Fire Truck Two | FIRE_TRUCK | South |
| Fire Truck Three | FIRE_TRUCK | East |
| Police Unit 1 | POLICE | North |
| Police Unit 2 | POLICE | South |
| Police Unit 3 | POLICE | East |

All start as `AVAILABLE`. Three per type makes it easy to exhaust a type live (the fourth `MEDICAL` incident becomes `PENDING` with a "no responder" reason).

## 5. notification_db

```sql
CREATE TABLE notifications (
    id          BIGSERIAL PRIMARY KEY,
    event_id    UUID         NOT NULL UNIQUE,           -- idempotency key from the event
    user_id     BIGINT       NOT NULL,                  -- logical ref to auth_db.users.id
    incident_id BIGINT       NOT NULL,                  -- logical ref to incident_db.incidents.id
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('INCIDENT_ASSIGNED','INCIDENT_PENDING')),
    message     VARCHAR(300) NOT NULL,
    is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
```

Duplicate delivery: catch the unique-violation on `event_id`, log, and acknowledge the message.

Message templates:

| Type | Message |
|---|---|
| `INCIDENT_ASSIGNED` | `Incident #{id} ({type}, {severity}) assigned to {responderName}.` |
| `INCIDENT_PENDING` | `Incident #{id} ({type}, {severity}) received. Waiting for a responder.` |

## 6. Entity-relationship view (logical, across services)

```text
auth_db.users (1) ---- (N) incident_db.incidents.reported_by_user_id
responder_db.responders (1) ---- (0..1) incident_db.incidents.assigned_responder_id
incident_db.incidents (1) ---- (N) notification_db.notifications.incident_id
auth_db.users (1) ---- (N) notification_db.notifications.user_id
```
Dashed in practice: these are references by id only and are never enforced by the database.

## 7. Init script for Postgres (reference)

```sql
CREATE USER auth_user         WITH PASSWORD :'AUTH_DB_PASSWORD';
CREATE USER incident_user     WITH PASSWORD :'INCIDENT_DB_PASSWORD';
CREATE USER responder_user    WITH PASSWORD :'RESPONDER_DB_PASSWORD';
CREATE USER notification_user WITH PASSWORD :'NOTIFICATION_DB_PASSWORD';

CREATE DATABASE auth_db         OWNER auth_user;
CREATE DATABASE incident_db     OWNER incident_user;
CREATE DATABASE responder_db    OWNER responder_user;
CREATE DATABASE notification_db OWNER notification_user;

REVOKE CONNECT ON DATABASE auth_db, incident_db, responder_db, notification_db FROM PUBLIC;
```

Mount it through `/docker-entrypoint-initdb.d/` (a `.sh` wrapper may read the passwords from environment variables
and call `psql -v`). It runs only on first start with an empty data directory; delete the PVC to re-run it.

#!/bin/bash
# Creates the four databases and four users (database-per-service).
# Runs once, on first start of an empty Postgres data directory.
# Passwords are read from environment variables (DEMO values in docker-compose.yml / k8s/01-secrets.yaml).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    CREATE USER auth_user         WITH PASSWORD '${AUTH_DB_PASSWORD}';
    CREATE USER incident_user     WITH PASSWORD '${INCIDENT_DB_PASSWORD}';
    CREATE USER responder_user    WITH PASSWORD '${RESPONDER_DB_PASSWORD}';
    CREATE USER notification_user WITH PASSWORD '${NOTIFICATION_DB_PASSWORD}';

    CREATE DATABASE auth_db         OWNER auth_user;
    CREATE DATABASE incident_db     OWNER incident_user;
    CREATE DATABASE responder_db    OWNER responder_user;
    CREATE DATABASE notification_db OWNER notification_user;

    -- Only the owner can connect: one service = one database = one user.
    REVOKE CONNECT ON DATABASE auth_db, incident_db, responder_db, notification_db FROM PUBLIC;
EOSQL

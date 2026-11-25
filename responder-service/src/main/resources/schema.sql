-- Extra database rules that JPA annotations cannot express (see docs/schema.md section 4).
-- Runs after Hibernate has created/updated the "responders" table; every statement is safe to repeat.

-- A responder is BUSY exactly when it holds an incident.
ALTER TABLE responders DROP CONSTRAINT IF EXISTS chk_busy_has_incident;
ALTER TABLE responders ADD CONSTRAINT chk_busy_has_incident CHECK (
    (status = 'BUSY' AND current_incident_id IS NOT NULL) OR
    (status <> 'BUSY' AND current_incident_id IS NULL));

-- One incident can never hold two responders (last line of defence against double assignment).
CREATE UNIQUE INDEX IF NOT EXISTS uq_responder_current_incident
    ON responders (current_incident_id) WHERE current_incident_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_responders_type_status ON responders (responder_type, status);

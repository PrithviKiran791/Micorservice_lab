package com.resqnet.responder.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One responder unit (ambulance, fire truck, police car) in responder_db.
 * "currentIncidentId" is a plain number pointing at an incident in ANOTHER service's database
 * (no foreign key across databases, rule R-DB-3).
 */
@Entity
@Table(name = "responders")
public class Responder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "responder_type", nullable = false, length = 15)
    private ResponderType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ResponderStatus status;

    @Column(length = 50)
    private String zone;

    @Column(name = "current_incident_id")
    private Long currentIncidentId;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Responder() {
        // required by JPA
    }

    public Responder(String name, ResponderType type, String zone) {
        this.name = name;
        this.type = type;
        this.zone = zone;
        this.status = ResponderStatus.AVAILABLE;
    }

    @PrePersist
    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    /** AVAILABLE -> BUSY for the given incident. */
    public void assignTo(Long incidentId) {
        this.status = ResponderStatus.BUSY;
        this.currentIncidentId = incidentId;
    }

    /** BUSY -> AVAILABLE. */
    public void release() {
        this.status = ResponderStatus.AVAILABLE;
        this.currentIncidentId = null;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public ResponderType getType() { return type; }
    public ResponderStatus getStatus() { return status; }
    public String getZone() { return zone; }
    public Long getCurrentIncidentId() { return currentIncidentId; }
    public Instant getUpdatedAt() { return updatedAt; }
}

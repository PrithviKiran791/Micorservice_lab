package com.resqnet.incident.model;

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

import java.math.BigDecimal;
import java.time.Instant;

/**
 * An emergency report, stored in incident_db.
 * The reporter and the responder are kept as plain ids + names (no foreign keys to other
 * services' databases), so an incident stays readable even when auth/responder services are down.
 */
@Entity
@Table(name = "incidents")
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "incident_type", nullable = false, length = 10)
    private IncidentType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Severity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private IncidentStatus status;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(name = "location_text", nullable = false, length = 200)
    private String locationText;

    @Column(precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(name = "reported_by_user_id", nullable = false)
    private Long reportedByUserId;

    @Column(name = "reported_by_username", nullable = false, length = 50)
    private String reportedByUsername;

    @Column(name = "assigned_responder_id")
    private Long assignedResponderId;

    @Column(name = "assigned_responder_name", length = 100)
    private String assignedResponderName;

    @Column(name = "assigned_responder_type", length = 15)
    private String assignedResponderType;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    protected Incident() {
        // required by JPA
    }

    /** A freshly reported incident starts as REPORTED. */
    public Incident(IncidentType type, Severity severity, String description, String locationText,
                    BigDecimal latitude, BigDecimal longitude, Long reportedByUserId, String reportedByUsername) {
        this.type = type;
        this.severity = severity;
        this.description = description;
        this.locationText = locationText;
        this.latitude = latitude;
        this.longitude = longitude;
        this.reportedByUserId = reportedByUserId;
        this.reportedByUsername = reportedByUsername;
        this.status = IncidentStatus.REPORTED;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public void markAssigned(Long responderId, String responderName, String responderType) {
        this.status = IncidentStatus.ASSIGNED;
        this.assignedResponderId = responderId;
        this.assignedResponderName = responderName;
        this.assignedResponderType = responderType;
    }

    public void markPending() {
        this.status = IncidentStatus.PENDING;
    }

    /** The responder details are kept after resolving, as history. */
    public void markResolved() {
        this.status = IncidentStatus.RESOLVED;
        this.resolvedAt = Instant.now();
    }

    public Long getId() { return id; }
    public IncidentType getType() { return type; }
    public Severity getSeverity() { return severity; }
    public IncidentStatus getStatus() { return status; }
    public String getDescription() { return description; }
    public String getLocationText() { return locationText; }
    public BigDecimal getLatitude() { return latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public Long getReportedByUserId() { return reportedByUserId; }
    public String getReportedByUsername() { return reportedByUsername; }
    public Long getAssignedResponderId() { return assignedResponderId; }
    public String getAssignedResponderName() { return assignedResponderName; }
    public String getAssignedResponderType() { return assignedResponderType; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getResolvedAt() { return resolvedAt; }
}

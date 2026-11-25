package com.resqnet.notification.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One notification for one user, stored in notification_db.
 * "eventId" is UNIQUE: it is the idempotency key. RabbitMQ delivers at-least-once, so the same event
 * can arrive twice; the unique column guarantees it can only ever create one notification.
 * userId / incidentId are plain numbers pointing into other services' databases (no foreign keys).
 */
@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, unique = true)
    private UUID eventId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "incident_id", nullable = false)
    private Long incidentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationType type;

    @Column(nullable = false, length = 300)
    private String message;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Notification() {
        // required by JPA
    }

    public Notification(UUID eventId, Long userId, Long incidentId, NotificationType type, String message) {
        this.eventId = eventId;
        this.userId = userId;
        this.incidentId = incidentId;
        this.type = type;
        this.message = message;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public void markRead() {
        this.read = true;
    }

    public Long getId() { return id; }
    public UUID getEventId() { return eventId; }
    public Long getUserId() { return userId; }
    public Long getIncidentId() { return incidentId; }
    public NotificationType getType() { return type; }
    public String getMessage() { return message; }
    public boolean isRead() { return read; }
    public Instant getCreatedAt() { return createdAt; }
}

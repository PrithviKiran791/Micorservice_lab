package com.resqnet.notification.messaging;

import java.time.Instant;

/**
 * The event as notification-service receives it (our own copy of the class: services share no code,
 * they only share the JSON shape defined in docs/API_CONTRACT.md section 9).
 */
public record IncidentEvent(
        String eventId,
        String eventType,
        Instant occurredAt,
        Long incidentId,
        Long userId,
        String username,
        String incidentType,
        String severity,
        String status,
        Responder responder) {

    public record Responder(Long id, String name) {
    }
}

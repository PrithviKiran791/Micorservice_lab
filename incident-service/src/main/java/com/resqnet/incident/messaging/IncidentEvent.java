package com.resqnet.incident.messaging;

import com.resqnet.incident.model.Incident;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * The event we publish to RabbitMQ (shape defined in docs/API_CONTRACT.md section 9).
 * "eventId" is unique per event: the consumer uses it to ignore duplicate deliveries.
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

    public static IncidentEvent assigned(Incident i) {
        return of("INCIDENT_ASSIGNED", i, new Responder(i.getAssignedResponderId(), i.getAssignedResponderName()));
    }

    public static IncidentEvent pending(Incident i) {
        return of("INCIDENT_PENDING", i, null);
    }

    private static IncidentEvent of(String eventType, Incident i, Responder responder) {
        return new IncidentEvent(UUID.randomUUID().toString(), eventType, Instant.now().truncatedTo(ChronoUnit.SECONDS),
                i.getId(), i.getReportedByUserId(), i.getReportedByUsername(),
                i.getType().name(), i.getSeverity().name(), i.getStatus().name(), responder);
    }
}

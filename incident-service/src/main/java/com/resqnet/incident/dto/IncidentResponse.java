package com.resqnet.incident.dto;

import com.resqnet.incident.model.Incident;

import java.math.BigDecimal;
import java.time.Instant;

/** The Incident object of the API contract. Entities are never returned directly (rule R-CD-3). */
public record IncidentResponse(
        Long id,
        String type,
        String severity,
        String status,
        String description,
        String locationText,
        BigDecimal latitude,
        BigDecimal longitude,
        ReportedBy reportedBy,
        AssignedResponder assignedResponder,
        Instant createdAt,
        Instant updatedAt,
        Instant resolvedAt) {

    public record ReportedBy(Long userId, String username) {
    }

    public record AssignedResponder(Long id, String name, String type) {
    }

    public static IncidentResponse from(Incident i) {
        AssignedResponder responder = i.getAssignedResponderId() == null ? null
                : new AssignedResponder(i.getAssignedResponderId(), i.getAssignedResponderName(), i.getAssignedResponderType());
        return new IncidentResponse(i.getId(), i.getType().name(), i.getSeverity().name(), i.getStatus().name(),
                i.getDescription(), i.getLocationText(), i.getLatitude(), i.getLongitude(),
                new ReportedBy(i.getReportedByUserId(), i.getReportedByUsername()), responder,
                i.getCreatedAt(), i.getUpdatedAt(), i.getResolvedAt());
    }
}

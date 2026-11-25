package com.resqnet.responder.dto;

import com.resqnet.responder.model.IncidentType;
import jakarta.validation.constraints.NotNull;

/** Body of POST /internal/responders/assign (sent by incident-service). */
public record AssignRequest(
        @NotNull Long incidentId,
        @NotNull IncidentType incidentType,
        String severity) {
}

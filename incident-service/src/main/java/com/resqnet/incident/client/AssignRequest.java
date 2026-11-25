package com.resqnet.incident.client;

/** Body we send to responder-service: POST /internal/responders/assign. */
public record AssignRequest(Long incidentId, String incidentType, String severity) {
}

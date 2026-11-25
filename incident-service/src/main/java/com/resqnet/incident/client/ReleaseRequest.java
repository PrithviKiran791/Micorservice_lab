package com.resqnet.incident.client;

/** Body we send to responder-service: POST /internal/responders/{id}/release. */
public record ReleaseRequest(Long incidentId) {
}

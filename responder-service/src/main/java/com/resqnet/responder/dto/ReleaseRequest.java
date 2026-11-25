package com.resqnet.responder.dto;

import jakarta.validation.constraints.NotNull;

/** Body of POST /internal/responders/{id}/release. */
public record ReleaseRequest(@NotNull Long incidentId) {
}

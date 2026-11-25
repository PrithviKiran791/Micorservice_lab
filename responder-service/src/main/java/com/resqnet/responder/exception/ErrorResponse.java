package com.resqnet.responder.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

/** The standard error body defined in docs/API_CONTRACT.md section 2. */
@JsonInclude(JsonInclude.Include.NON_NULL)   // "details" only appears for validation errors
public record ErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String code,
        String message,
        String path,
        List<FieldIssue> details) {

    /** One invalid field in a validation error. */
    public record FieldIssue(String field, String message) {
    }
}

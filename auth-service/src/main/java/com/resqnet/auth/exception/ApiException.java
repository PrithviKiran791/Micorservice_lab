package com.resqnet.auth.exception;

import org.springframework.http.HttpStatus;

/**
 * A business error carrying the HTTP status and the machine-readable "code"
 * from the API contract (for example 409 USERNAME_TAKEN). Turned into the
 * standard JSON error body by GlobalExceptionHandler.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
}

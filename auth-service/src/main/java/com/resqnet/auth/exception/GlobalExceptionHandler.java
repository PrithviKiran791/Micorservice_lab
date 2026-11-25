package com.resqnet.auth.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * One place that converts every exception into the standard JSON error body.
 * @RestControllerAdvice makes these handlers apply to all controllers in the service.
 * Stack traces are logged but never sent to the client.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex, HttpServletRequest request) {
        return build(ex.getStatus(), ex.getCode(), ex.getMessage(), request, null);
    }

    /** Bean Validation failed (@Valid on the request body). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<ErrorResponse.FieldIssue> details = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> new ErrorResponse.FieldIssue(e.getField(), e.getDefaultMessage()))
                .toList();
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Validation failed", request, details);
    }

    /** Body is missing or is not valid JSON. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Malformed or missing request body", request, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unexpected error on {}", request.getRequestURI(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Unexpected error", request, null);
    }

    private ResponseEntity<ErrorResponse> build(HttpStatus status, String code, String message,
                                                HttpServletRequest request, List<ErrorResponse.FieldIssue> details) {
        ErrorResponse body = new ErrorResponse(Instant.now().truncatedTo(ChronoUnit.SECONDS), status.value(),
                status.getReasonPhrase(), code, message, publicPath(request), details);
        return ResponseEntity.status(status).body(body);
    }

    /**
     * The gateway removes "/api" before forwarding but tells us in the X-Gateway-Prefix header,
     * so errors can report the path the client really called (for example /api/auth/register).
     */
    private String publicPath(HttpServletRequest request) {
        String prefix = request.getHeader("X-Gateway-Prefix");
        return (prefix == null ? "" : prefix) + request.getRequestURI();
    }
}

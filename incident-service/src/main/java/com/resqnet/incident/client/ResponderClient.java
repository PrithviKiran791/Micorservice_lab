package com.resqnet.incident.client;

import com.resqnet.incident.exception.ApiException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.Optional;

/**
 * The ONLY synchronous call between services (incident-service -> responder-service).
 *
 * HARD IDEA #2 - the circuit breaker with fallback:
 * @CircuitBreaker wraps each method in a "breaker" (settings in application.yml, name "responderService").
 *   CLOSED    : calls go through; the last 5 results are counted.
 *   OPEN      : after >= 50 % failures (min. 3 calls) calls are NOT even attempted for 10 s;
 *               they fail instantly, so a dead responder-service cannot make us slow.
 *   HALF_OPEN : after 10 s two probe calls are allowed; success closes the breaker again.
 * Whenever the call throws (connection refused, 2 s timeout, 5xx, breaker open), Resilience4j
 * calls the "fallbackMethod" instead, so the caller still gets an answer. The annotation works
 * through a Spring proxy, which is why this logic lives in its own bean, not in IncidentService.
 */
@Component
public class ResponderClient {

    private static final Logger log = LoggerFactory.getLogger(ResponderClient.class);

    private final RestClient restClient;

    public ResponderClient(RestClient responderRestClient) {
        this.restClient = responderRestClient;
    }

    /**
     * Asks responder-service for a responder.
     * Returns the responder, or Optional.empty() when none is free (HTTP 409).
     * A 409 is a normal business answer, so it is handled here and is NOT a breaker failure (rule R-RS-2).
     */
    @CircuitBreaker(name = "responderService", fallbackMethod = "assignFallback")
    public Optional<AssignedResponder> assign(AssignRequest request) {
        try {
            return Optional.ofNullable(restClient.post()
                    .uri("/internal/responders/assign")
                    .body(request)
                    .retrieve()
                    .body(AssignedResponder.class));
        } catch (HttpClientErrorException.Conflict e) {
            log.info("incidentId={} responder-service has no free responder (409)", request.incidentId());
            return Optional.empty();
        }
    }

    /** Fallback: responder-service is unreachable/slow/failing/breaker open -> "no responder now" (incident becomes PENDING). */
    public Optional<AssignedResponder> assignFallback(AssignRequest request, Throwable cause) {
        log.warn("incidentId={} FALLBACK used (responder-service unavailable): {}", request.incidentId(), cause.toString());
        return Optional.empty();
    }

    /** Frees the responder when an incident is resolved. If responder-service is down the fallback raises 503. */
    @CircuitBreaker(name = "responderService", fallbackMethod = "releaseFallback")
    public void release(Long responderId, ReleaseRequest request) {
        restClient.post()
                .uri("/internal/responders/{id}/release", responderId)
                .body(request)
                .retrieve()
                .toBodilessEntity();
    }

    public void releaseFallback(Long responderId, ReleaseRequest request, Throwable cause) {
        log.warn("incidentId={} release of responderId={} failed: {}", request.incidentId(), responderId, cause.toString());
        if (cause instanceof HttpClientErrorException) {
            // responder-service answered but refused (e.g. busy with another incident)
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE", "Responder could not be released");
        }
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE",
                "Responder service is unavailable");
    }
}

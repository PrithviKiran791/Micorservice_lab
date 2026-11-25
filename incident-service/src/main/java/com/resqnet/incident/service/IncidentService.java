package com.resqnet.incident.service;

import com.resqnet.incident.client.AssignRequest;
import com.resqnet.incident.client.AssignedResponder;
import com.resqnet.incident.client.ReleaseRequest;
import com.resqnet.incident.client.ResponderClient;
import com.resqnet.incident.dto.CreateIncidentRequest;
import com.resqnet.incident.dto.IncidentResponse;
import com.resqnet.incident.exception.ApiException;
import com.resqnet.incident.messaging.IncidentEventPublisher;
import com.resqnet.incident.model.Incident;
import com.resqnet.incident.model.IncidentStatus;
import com.resqnet.incident.repository.IncidentRepository;
import com.resqnet.incident.security.CurrentUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Business logic of incident-service.
 *
 * IMPORTANT (rule R-AR-7): the methods here are deliberately NOT @Transactional.
 * Each repository.save(...) is its own short transaction that commits immediately.
 * The slow network call to responder-service happens BETWEEN two saves, never inside a
 * database transaction, so a slow responder-service can never hold a database connection hostage.
 */
@Service
public class IncidentService {

    private static final Logger log = LoggerFactory.getLogger(IncidentService.class);

    private final IncidentRepository repository;
    private final ResponderClient responderClient;
    private final IncidentEventPublisher eventPublisher;

    public IncidentService(IncidentRepository repository, ResponderClient responderClient,
                           IncidentEventPublisher eventPublisher) {
        this.repository = repository;
        this.responderClient = responderClient;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Report an incident. Always succeeds (201) even if responder-service is down:
     *  1. save as REPORTED (committed),  2. ask responder-service,  3. save ASSIGNED or PENDING.
     */
    public IncidentResponse create(CurrentUser user, CreateIncidentRequest request) {
        Incident incident = repository.save(new Incident(request.type(), request.severity(),
                request.description(), request.locationText(), request.latitude(), request.longitude(),
                user.id(), user.username()));
        log.info("incidentId={} created by userId={} type={} severity={}",
                incident.getId(), user.id(), incident.getType(), incident.getSeverity());
        incident = tryAssign(incident);
        // The incident is saved and committed; now tell notification-service asynchronously (RabbitMQ).
        if (incident.getStatus() == IncidentStatus.ASSIGNED) {
            eventPublisher.publishAssigned(incident);
        } else {
            eventPublisher.publishPending(incident);
        }
        return IncidentResponse.from(incident);
    }

    /** Admin retry for a PENDING incident. May still end PENDING if nobody is free or the service is down. */
    public IncidentResponse dispatch(CurrentUser user, Long id) {
        user.requireAdmin();
        Incident incident = find(id);
        if (incident.getStatus() != IncidentStatus.PENDING) {
            throw invalidState("Only a PENDING incident can be dispatched");
        }
        incident = tryAssign(incident);
        // Only a success is worth a notification; a failed retry would just repeat "waiting for a responder".
        if (incident.getStatus() == IncidentStatus.ASSIGNED) {
            eventPublisher.publishAssigned(incident);
        }
        return IncidentResponse.from(incident);
    }

    /** Admin closes an ASSIGNED incident: free the responder first, then mark RESOLVED. */
    public IncidentResponse resolve(CurrentUser user, Long id) {
        user.requireAdmin();
        Incident incident = find(id);
        if (incident.getStatus() != IncidentStatus.ASSIGNED) {
            throw invalidState("Only an ASSIGNED incident can be resolved");
        }
        // If responder-service is down this throws 503 and the incident stays ASSIGNED (state unchanged).
        responderClient.release(incident.getAssignedResponderId(), new ReleaseRequest(incident.getId()));
        incident.markResolved();
        incident = repository.save(incident);
        log.info("incidentId={} resolved by userId={}", incident.getId(), user.id());
        return IncidentResponse.from(incident);
    }

    /** USER sees only own incidents, ADMIN sees all; optional status filter. */
    public List<IncidentResponse> list(CurrentUser user, IncidentStatus status) {
        List<Incident> found;
        if (user.isAdmin()) {
            found = status == null ? repository.findAllByOrderByCreatedAtDesc()
                    : repository.findByStatusOrderByCreatedAtDesc(status);
        } else {
            found = status == null ? repository.findByReportedByUserIdOrderByCreatedAtDesc(user.id())
                    : repository.findByReportedByUserIdAndStatusOrderByCreatedAtDesc(user.id(), status);
        }
        return found.stream().map(IncidentResponse::from).toList();
    }

    public IncidentResponse get(CurrentUser user, Long id) {
        Incident incident = find(id);
        user.requireOwnerOrAdmin(incident.getReportedByUserId());
        return IncidentResponse.from(incident);
    }

    /**
     * Calls responder-service (protected by the circuit breaker) and stores the outcome:
     * a responder -> ASSIGNED, nothing (none free / service down / breaker open) -> PENDING.
     */
    private Incident tryAssign(Incident incident) {
        Optional<AssignedResponder> result = responderClient.assign(new AssignRequest(
                incident.getId(), incident.getType().name(), incident.getSeverity().name()));

        if (result.isPresent()) {
            AssignedResponder r = result.get();
            incident.markAssigned(r.responderId(), r.name(), r.type());
        } else {
            incident.markPending();
        }
        Incident saved = repository.save(incident);
        log.info("incidentId={} result={} responderId={}", saved.getId(), saved.getStatus(), saved.getAssignedResponderId());
        return saved;
    }

    private Incident find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Incident not found"));
    }

    private ApiException invalidState(String message) {
        return new ApiException(HttpStatus.CONFLICT, "INVALID_STATE", message);
    }
}

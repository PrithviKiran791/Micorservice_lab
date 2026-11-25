package com.resqnet.responder.service;

import com.resqnet.responder.dto.AssignRequest;
import com.resqnet.responder.dto.AssignResponse;
import com.resqnet.responder.dto.ReleaseRequest;
import com.resqnet.responder.dto.ReleaseResponse;
import com.resqnet.responder.dto.ResponderResponse;
import com.resqnet.responder.exception.ApiException;
import com.resqnet.responder.model.Responder;
import com.resqnet.responder.model.ResponderStatus;
import com.resqnet.responder.model.ResponderType;
import com.resqnet.responder.repository.ResponderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Business logic of responder-service: browsing responders and the atomic assign / release. */
@Service
public class ResponderService {

    private static final Logger log = LoggerFactory.getLogger(ResponderService.class);

    private final ResponderRepository repository;

    public ResponderService(ResponderRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ResponderResponse> list(ResponderStatus status, ResponderType type) {
        List<Responder> found;
        if (status != null && type != null) {
            found = repository.findByStatusAndTypeOrderByIdAsc(status, type);
        } else if (status != null) {
            found = repository.findByStatusOrderByIdAsc(status);
        } else if (type != null) {
            found = repository.findByTypeOrderByIdAsc(type);
        } else {
            found = repository.findAllByOrderByIdAsc();
        }
        return found.stream().map(ResponderResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ResponderResponse get(Long id) {
        return ResponderResponse.from(repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Responder not found")));
    }

    /**
     * Gives the incident one free responder of the right type. (hard idea #1: atomic assignment)
     *
     * @Transactional = everything below is ONE database transaction. The row lock taken by
     * lockFirstAvailable() is held until this method returns, which is exactly long enough
     * to mark the responder BUSY. Steps:
     *  1. Idempotency: if this incident already holds a responder, return it unchanged
     *     (so a retried call can never take a second responder).
     *  2. Lock the first AVAILABLE responder of the mapped type (FOR UPDATE SKIP LOCKED).
     *  3. None left -> 409 NO_RESPONDER_AVAILABLE (the caller turns this into a PENDING incident).
     *  4. Mark it BUSY with the incident id; the commit publishes the change and releases the lock.
     */
    @Transactional
    public AssignResponse assign(AssignRequest request) {
        Long incidentId = request.incidentId();

        var existing = repository.findByCurrentIncidentId(incidentId);
        if (existing.isPresent()) {
            log.info("assign incidentId={} already holds responderId={} (idempotent)", incidentId, existing.get().getId());
            return toAssignResponse(existing.get());
        }

        ResponderType wanted = ResponderType.forIncident(request.incidentType());
        Responder responder = repository.lockFirstAvailable(wanted.name())
                .orElseThrow(() -> {
                    log.info("assign incidentId={} no {} available", incidentId, wanted);
                    return new ApiException(HttpStatus.CONFLICT, "NO_RESPONDER_AVAILABLE",
                            "No available responder of type " + wanted);
                });

        responder.assignTo(incidentId);
        repository.saveAndFlush(responder);
        log.info("assign incidentId={} -> responderId={} ({})", incidentId, responder.getId(), responder.getName());
        return toAssignResponse(responder);
    }

    /**
     * Frees a responder after an incident is resolved. Idempotent: releasing an already
     * available responder is a successful no-op. A responder busy with a DIFFERENT incident
     * is never freed by mistake.
     */
    @Transactional
    public ReleaseResponse release(Long responderId, ReleaseRequest request) {
        Responder responder = repository.findById(responderId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Responder not found"));

        if (responder.getStatus() == ResponderStatus.BUSY) {
            if (!request.incidentId().equals(responder.getCurrentIncidentId())) {
                throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE",
                        "Responder is busy with a different incident");
            }
            responder.release();
            repository.saveAndFlush(responder);
            log.info("release incidentId={} responderId={} -> AVAILABLE", request.incidentId(), responderId);
        }
        return new ReleaseResponse(responder.getId(), responder.getStatus().name());
    }

    private AssignResponse toAssignResponse(Responder r) {
        return new AssignResponse(r.getId(), r.getName(), r.getType().name());
    }
}

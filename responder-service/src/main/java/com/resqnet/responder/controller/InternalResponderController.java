package com.resqnet.responder.controller;

import com.resqnet.responder.dto.AssignRequest;
import com.resqnet.responder.dto.AssignResponse;
import com.resqnet.responder.dto.ReleaseRequest;
import com.resqnet.responder.dto.ReleaseResponse;
import com.resqnet.responder.service.ResponderService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Service-to-service endpoints, called only by incident-service inside the cluster.
 * The gateway has NO route to /internal/**, and the Kubernetes Service is ClusterIP,
 * so clients outside cannot reach these.
 */
@RestController
@RequestMapping("/internal/responders")
public class InternalResponderController {

    private final ResponderService service;

    public InternalResponderController(ResponderService service) {
        this.service = service;
    }

    @PostMapping("/assign")
    public AssignResponse assign(@Valid @RequestBody AssignRequest request) {
        return service.assign(request);
    }

    @PostMapping("/{id}/release")
    public ReleaseResponse release(@PathVariable Long id, @Valid @RequestBody ReleaseRequest request) {
        return service.release(id, request);
    }
}

package com.resqnet.responder.controller;

import com.resqnet.responder.dto.ResponderResponse;
import com.resqnet.responder.model.ResponderStatus;
import com.resqnet.responder.model.ResponderType;
import com.resqnet.responder.service.ResponderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public read endpoints (reached through the gateway as /api/responders/**).
 * Any authenticated user may read; the gateway already rejected anonymous callers.
 */
@RestController
@RequestMapping("/responders")
public class ResponderController {

    private final ResponderService service;

    public ResponderController(ResponderService service) {
        this.service = service;
    }

    /** Optional filters, e.g. GET /responders?status=AVAILABLE&type=AMBULANCE. */
    @GetMapping
    public List<ResponderResponse> list(@RequestParam(required = false) ResponderStatus status,
                                        @RequestParam(required = false) ResponderType type) {
        return service.list(status, type);
    }

    @GetMapping("/{id}")
    public ResponderResponse get(@PathVariable Long id) {
        return service.get(id);
    }
}

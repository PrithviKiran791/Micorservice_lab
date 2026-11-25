package com.resqnet.incident.controller;

import com.resqnet.incident.dto.CreateIncidentRequest;
import com.resqnet.incident.dto.IncidentResponse;
import com.resqnet.incident.model.IncidentStatus;
import com.resqnet.incident.security.CurrentUser;
import com.resqnet.incident.service.IncidentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * HTTP layer only. The gateway strips "/api", so /api/incidents/** arrives here as /incidents/**.
 * Each method first reads the caller's identity from the gateway's X-User-* headers; role rules
 * are applied in the service.
 */
@RestController
@RequestMapping("/incidents")
public class IncidentController {

    private final IncidentService service;

    public IncidentController(IncidentService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IncidentResponse create(HttpServletRequest http, @Valid @RequestBody CreateIncidentRequest body) {
        return service.create(CurrentUser.from(http), body);
    }

    @GetMapping
    public List<IncidentResponse> list(HttpServletRequest http,
                                       @RequestParam(required = false) IncidentStatus status) {
        return service.list(CurrentUser.from(http), status);
    }

    @GetMapping("/{id}")
    public IncidentResponse get(HttpServletRequest http, @PathVariable Long id) {
        return service.get(CurrentUser.from(http), id);
    }

    @PostMapping("/{id}/dispatch")
    public IncidentResponse dispatch(HttpServletRequest http, @PathVariable Long id) {
        return service.dispatch(CurrentUser.from(http), id);
    }

    @PostMapping("/{id}/resolve")
    public IncidentResponse resolve(HttpServletRequest http, @PathVariable Long id) {
        return service.resolve(CurrentUser.from(http), id);
    }
}

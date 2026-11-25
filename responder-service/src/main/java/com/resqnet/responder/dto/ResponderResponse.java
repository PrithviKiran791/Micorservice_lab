package com.resqnet.responder.dto;

import com.resqnet.responder.model.Responder;

/** Responder object of the API contract (never return the entity itself). */
public record ResponderResponse(Long id, String name, String type, String status, String zone, Long currentIncidentId) {

    public static ResponderResponse from(Responder r) {
        return new ResponderResponse(r.getId(), r.getName(), r.getType().name(), r.getStatus().name(),
                r.getZone(), r.getCurrentIncidentId());
    }
}

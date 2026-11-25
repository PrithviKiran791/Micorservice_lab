package com.resqnet.incident.client;

/** The responder that responder-service gave us. (Our own copy of the DTO: services share no classes.) */
public record AssignedResponder(Long responderId, String name, String type) {
}

package com.resqnet.responder.dto;

/** 200 response of assign: which responder was given to the incident. */
public record AssignResponse(Long responderId, String name, String type) {
}

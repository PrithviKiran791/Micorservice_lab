package com.resqnet.incident.model;

/**
 * Lifecycle: REPORTED (saved, transient) -> ASSIGNED or PENDING;
 * PENDING -> ASSIGNED (admin dispatch); ASSIGNED -> RESOLVED (admin resolve).
 */
public enum IncidentStatus {
    REPORTED,
    ASSIGNED,
    PENDING,
    RESOLVED
}

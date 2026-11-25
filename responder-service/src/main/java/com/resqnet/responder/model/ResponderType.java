package com.resqnet.responder.model;

/** Kind of responder vehicle/unit. */
public enum ResponderType {
    AMBULANCE,
    FIRE_TRUCK,
    POLICE;

    /** Which responder type handles which incident: MEDICAL -> AMBULANCE, FIRE -> FIRE_TRUCK, POLICE -> POLICE. */
    public static ResponderType forIncident(IncidentType incidentType) {
        return switch (incidentType) {
            case MEDICAL -> AMBULANCE;
            case FIRE -> FIRE_TRUCK;
            case POLICE -> POLICE;
        };
    }
}

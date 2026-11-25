package com.resqnet.responder.model;

/** AVAILABLE --assign--> BUSY --release--> AVAILABLE; an admin can toggle AVAILABLE <-> OFFLINE. */
public enum ResponderStatus {
    AVAILABLE,
    BUSY,
    OFFLINE
}

package com.resqnet.notification.dto;

import com.resqnet.notification.model.Notification;

import java.time.Instant;

/** The Notification object of the API contract. */
public record NotificationResponse(Long id, Long userId, Long incidentId, String type, String message,
                                   boolean read, Instant createdAt) {

    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(n.getId(), n.getUserId(), n.getIncidentId(), n.getType().name(),
                n.getMessage(), n.isRead(), n.getCreatedAt());
    }
}

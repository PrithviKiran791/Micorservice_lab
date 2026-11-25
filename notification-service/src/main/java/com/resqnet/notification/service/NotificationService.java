package com.resqnet.notification.service;

import com.resqnet.notification.dto.NotificationResponse;
import com.resqnet.notification.exception.ApiException;
import com.resqnet.notification.messaging.IncidentEvent;
import com.resqnet.notification.model.Notification;
import com.resqnet.notification.model.NotificationType;
import com.resqnet.notification.repository.NotificationRepository;
import com.resqnet.notification.security.CurrentUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Business logic of notification-service: store notifications from events, and serve them to users. */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    /**
     * Turns one incident event into one notification, AT MOST ONCE per eventId (hard idea: idempotent consumer).
     * RabbitMQ guarantees "at least once" delivery, so the same event can legitimately arrive again
     * (for example after a crash before the acknowledgement). Two layers stop the duplicate:
     *  1. a quick existsByEventId() check, and
     *  2. the UNIQUE constraint on event_id, for two copies being processed at the very same moment.
     * In both cases we just skip it and return normally, so the message is acknowledged and not redelivered.
     * Not @Transactional on purpose: save() is its own transaction, so catching its failure here is safe.
     */
    public void recordEvent(IncidentEvent event) {
        Notification notification = toNotification(event);

        if (repository.existsByEventId(notification.getEventId())) {
            log.info("incidentId={} duplicate eventId={} ignored", event.incidentId(), event.eventId());
            return;
        }
        try {
            repository.saveAndFlush(notification);
            log.info("incidentId={} notification created for userId={} type={}",
                    event.incidentId(), event.userId(), notification.getType());
        } catch (DataIntegrityViolationException e) {
            log.info("incidentId={} duplicate eventId={} ignored (unique constraint)", event.incidentId(), event.eventId());
        }
    }

    /** USER: own notifications. ADMIN: all, or only own with ?mine=true. */
    public List<NotificationResponse> list(CurrentUser user, boolean mine) {
        List<Notification> found = (user.isAdmin() && !mine)
                ? repository.findAllByOrderByCreatedAtDesc()
                : repository.findByUserIdOrderByCreatedAtDesc(user.id());
        return found.stream().map(NotificationResponse::from).toList();
    }

    /** Marks one notification as read: its owner or an admin. */
    public NotificationResponse markRead(CurrentUser user, Long id) {
        Notification notification = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Notification not found"));
        user.requireOwnerOrAdmin(notification.getUserId());
        notification.markRead();
        return NotificationResponse.from(repository.save(notification));
    }

    /** Builds the notification text from the templates in docs/schema.md. A broken event is rejected, not retried. */
    private Notification toNotification(IncidentEvent e) {
        try {
            if (e == null || e.userId() == null || e.incidentId() == null) {
                throw new IllegalArgumentException("userId/incidentId missing");
            }
            UUID eventId = UUID.fromString(e.eventId());
            NotificationType type = NotificationType.valueOf(e.eventType());
            String summary = "Incident #" + e.incidentId() + " (" + e.incidentType() + ", " + e.severity() + ")";
            String message = type == NotificationType.INCIDENT_ASSIGNED
                    ? summary + " assigned to " + (e.responder() == null ? "a responder" : e.responder().name()) + "."
                    : summary + " received. Waiting for a responder.";
            return new Notification(eventId, e.userId(), e.incidentId(), type, message);
        } catch (RuntimeException ex) {
            log.error("Rejecting malformed event {}: {}", e == null ? null : e.eventId(), ex.toString());
            throw new AmqpRejectAndDontRequeueException("Malformed incident event", ex);
        }
    }
}

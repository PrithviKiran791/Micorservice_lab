package com.resqnet.notification.messaging;

import com.resqnet.notification.service.NotificationService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * The receiving end of the asynchronous event.
 * @RabbitListener makes Spring keep a consumer on the queue "notification.incidents"; every message
 * is converted from JSON to an IncidentEvent and handed to this method, on a background thread,
 * completely independent of any HTTP request.
 * If the method returns normally the message is acknowledged (removed from the queue); if it throws,
 * the message is rejected (and not requeued, see application.yml).
 */
@Component
public class IncidentEventListener {

    private final NotificationService notificationService;

    public IncidentEventListener(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = RabbitConfig.QUEUE)
    public void onIncidentEvent(IncidentEvent event) {
        notificationService.recordEvent(event);
    }
}

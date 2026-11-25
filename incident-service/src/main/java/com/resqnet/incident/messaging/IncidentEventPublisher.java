package com.resqnet.incident.messaging;

import com.resqnet.incident.model.Incident;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

/**
 * Sends incident events to RabbitMQ. This is the ASYNCHRONOUS communication of the project:
 * we hand the message to the broker and carry on; we never wait for notification-service.
 *
 * A failed publish must NOT fail the incident request (rule R-MQ-4): the incident is already saved,
 * so we log at ERROR with the incident id and move on. (Known trade-off D7: without an "outbox" such an
 * event is lost.)
 */
@Component
public class IncidentEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(IncidentEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public IncidentEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishAssigned(Incident incident) {
        publish(RabbitConfig.ROUTING_ASSIGNED, IncidentEvent.assigned(incident));
    }

    public void publishPending(Incident incident) {
        publish(RabbitConfig.ROUTING_PENDING, IncidentEvent.pending(incident));
    }

    private void publish(String routingKey, IncidentEvent event) {
        try {
            rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, routingKey, event);
            log.info("incidentId={} published {} eventId={}", event.incidentId(), routingKey, event.eventId());
        } catch (Exception e) {
            log.error("incidentId={} could NOT publish {}: {}", event.incidentId(), routingKey, e.toString());
        }
    }
}

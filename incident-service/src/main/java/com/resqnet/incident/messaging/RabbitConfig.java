package com.resqnet.incident.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ topology, declared in code on BOTH sides (rule R-MQ-5), so it does not matter which
 * service starts first: whoever connects first creates the exchange, queue and binding
 * (declaring something that already exists, identically, is harmless).
 *
 *   incident-service --(routing key incident.assigned / incident.pending)--> exchange "resqnet.events"
 *   exchange --(binding "incident.*")--> queue "notification.incidents" --> notification-service
 */
@Configuration
public class RabbitConfig {

    public static final String EXCHANGE = "resqnet.events";
    public static final String QUEUE = "notification.incidents";
    public static final String ROUTING_ASSIGNED = "incident.assigned";
    public static final String ROUTING_PENDING = "incident.pending";

    /** A topic exchange routes by pattern; durable = survives a RabbitMQ restart. */
    @Bean
    public TopicExchange eventsExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    /** The mailbox of notification-service. Declared here too so events are never lost if it is not up yet. */
    @Bean
    public Queue notificationQueue() {
        return new Queue(QUEUE, true);
    }

    /** "incident.*" matches incident.assigned and incident.pending. */
    @Bean
    public Binding notificationBinding(Queue notificationQueue, TopicExchange eventsExchange) {
        return BindingBuilder.bind(notificationQueue).to(eventsExchange).with("incident.*");
    }

    /** Messages are sent as JSON text (not Java serialization). Spring Boot's ObjectMapper writes dates as ISO-8601. */
    @Bean
    public MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }
}

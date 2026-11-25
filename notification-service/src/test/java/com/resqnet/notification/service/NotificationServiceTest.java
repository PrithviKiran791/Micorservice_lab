package com.resqnet.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resqnet.notification.dto.NotificationResponse;
import com.resqnet.notification.exception.ApiException;
import com.resqnet.notification.messaging.IncidentEvent;
import com.resqnet.notification.repository.NotificationRepository;
import com.resqnet.notification.security.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.amqp.support.converter.SmartMessageConverter;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real PostgreSQL via Testcontainers. The RabbitMQ listener is switched off (no broker in tests);
 * events are handed to the service directly, exactly as the listener would.
 */
@SpringBootTest(properties = "spring.rabbitmq.listener.simple.auto-startup=false")
@Testcontainers
class NotificationServiceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Autowired NotificationService service;
    @Autowired NotificationRepository repository;
    @Autowired MessageConverter messageConverter;
    @Autowired ObjectMapper objectMapper;

    final CurrentUser asha = new CurrentUser(2L, "asha", "USER");
    final CurrentUser ravi = new CurrentUser(3L, "ravi", "USER");
    final CurrentUser admin = new CurrentUser(1L, "admin", "ADMIN");

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    @Test
    void assignedEventCreatesOneNotificationWithTheTemplateText() {
        service.recordEvent(assignedEvent(UUID.randomUUID(), 11L, 2L));

        List<NotificationResponse> mine = service.list(asha, false);
        assertEquals(1, mine.size());
        assertEquals("INCIDENT_ASSIGNED", mine.get(0).type());
        assertEquals("Incident #11 (MEDICAL, CRITICAL) assigned to Ambulance Alpha.", mine.get(0).message());
        assertFalse(mine.get(0).read());
        assertEquals(11L, mine.get(0).incidentId());
    }

    @Test
    void pendingEventUsesThePendingTemplate() {
        service.recordEvent(new IncidentEvent(UUID.randomUUID().toString(), "INCIDENT_PENDING", Instant.now(),
                12L, 2L, "asha", "FIRE", "MEDIUM", "PENDING", null));

        assertEquals("Incident #12 (FIRE, MEDIUM) received. Waiting for a responder.",
                service.list(asha, false).get(0).message());
    }

    @Test
    void duplicateEventIdDoesNotCreateASecondNotification() {
        UUID eventId = UUID.randomUUID();

        service.recordEvent(assignedEvent(eventId, 11L, 2L));
        service.recordEvent(assignedEvent(eventId, 11L, 2L));       // redelivery of the same event

        assertEquals(1, repository.count());
    }

    @Test
    void sameEventProcessedByManyThreadsAtOnceStillCreatesOnlyOne() throws Exception {
        UUID eventId = UUID.randomUUID();
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<?>> futures = new java.util.ArrayList<>();
        for (int i = 0; i < threads; i++) {
            Callable<Void> task = () -> { go.await(); service.recordEvent(assignedEvent(eventId, 11L, 2L)); return null; };
            futures.add(pool.submit(task));
        }
        go.countDown();
        for (Future<?> f : futures) {
            f.get();                              // none of them may throw: duplicates are skipped quietly
        }
        pool.shutdown();

        assertEquals(1, repository.count());
    }

    @Test
    void differentEventsForTheSameIncidentBothCreateNotifications() {
        service.recordEvent(assignedEvent(UUID.randomUUID(), 11L, 2L));
        service.recordEvent(assignedEvent(UUID.randomUUID(), 11L, 2L));

        assertEquals(2, repository.count());
    }

    @Test
    void malformedEventIsRejectedWithoutRequeue() {
        IncidentEvent noUser = new IncidentEvent(UUID.randomUUID().toString(), "INCIDENT_ASSIGNED", Instant.now(),
                11L, null, "asha", "MEDICAL", "CRITICAL", "ASSIGNED", null);
        IncidentEvent badType = new IncidentEvent(UUID.randomUUID().toString(), "SOMETHING_ELSE", Instant.now(),
                11L, 2L, "asha", "MEDICAL", "CRITICAL", "ASSIGNED", null);
        IncidentEvent badId = new IncidentEvent("not-a-uuid", "INCIDENT_ASSIGNED", Instant.now(),
                11L, 2L, "asha", "MEDICAL", "CRITICAL", "ASSIGNED", null);

        assertThrows(AmqpRejectAndDontRequeueException.class, () -> service.recordEvent(noUser));
        assertThrows(AmqpRejectAndDontRequeueException.class, () -> service.recordEvent(badType));
        assertThrows(AmqpRejectAndDontRequeueException.class, () -> service.recordEvent(badId));
        assertEquals(0, repository.count());
    }

    @Test
    void jsonPublishedByIncidentServiceIsUnderstood() {
        // exactly the JSON that incident-service sends, including its own (unknown here) __TypeId__ header
        String json = """
                {"eventId":"6f1c2b9e-7e0a-4b0e-9d6a-1d2f3c4b5a69","eventType":"INCIDENT_ASSIGNED",
                 "occurredAt":"2026-11-25T14:30:01Z","incidentId":11,"userId":2,"username":"asha",
                 "incidentType":"MEDICAL","severity":"CRITICAL","status":"ASSIGNED",
                 "responder":{"id":1,"name":"Ambulance Alpha"}}""";
        MessageProperties props = new MessageProperties();
        props.setContentType("application/json");
        props.setHeader("__TypeId__", "com.resqnet.incident.messaging.IncidentEvent");

        // a @RabbitListener(IncidentEvent) method makes Spring pass the parameter type as the "hint"
        Object converted = ((SmartMessageConverter) messageConverter).fromMessage(
                new Message(json.getBytes(StandardCharsets.UTF_8), props),
                new ParameterizedTypeReference<IncidentEvent>() { });

        IncidentEvent event = (IncidentEvent) converted;
        assertEquals("INCIDENT_ASSIGNED", event.eventType());
        assertEquals(11L, event.incidentId());
        assertEquals("Ambulance Alpha", event.responder().name());
        assertEquals(Instant.parse("2026-11-25T14:30:01Z"), event.occurredAt());
    }

    @Test
    void usersSeeOnlyTheirOwn_adminSeesAll_adminMineFiltersToOwn() {
        service.recordEvent(assignedEvent(UUID.randomUUID(), 11L, 2L));
        service.recordEvent(assignedEvent(UUID.randomUUID(), 12L, 3L));

        assertEquals(1, service.list(asha, false).size());
        assertEquals(1, service.list(ravi, false).size());
        assertEquals(2, service.list(admin, false).size());
        assertEquals(0, service.list(admin, true).size());
    }

    @Test
    void markReadByOwnerWorks_otherUserGets403_unknownIs404() {
        service.recordEvent(assignedEvent(UUID.randomUUID(), 11L, 2L));
        Long id = service.list(asha, false).get(0).id();

        assertEquals("FORBIDDEN", assertThrows(ApiException.class, () -> service.markRead(ravi, id)).getCode());
        assertEquals("NOT_FOUND", assertThrows(ApiException.class, () -> service.markRead(asha, 999999L)).getCode());
        assertTrue(service.markRead(asha, id).read());
        assertTrue(service.list(asha, false).get(0).read());
    }

    private IncidentEvent assignedEvent(UUID eventId, Long incidentId, Long userId) {
        return new IncidentEvent(eventId.toString(), "INCIDENT_ASSIGNED", Instant.now(), incidentId, userId, "u" + userId,
                "MEDICAL", "CRITICAL", "ASSIGNED", new IncidentEvent.Responder(1L, "Ambulance Alpha"));
    }
}

package com.resqnet.incident.service;

import com.resqnet.incident.dto.CreateIncidentRequest;
import com.resqnet.incident.dto.IncidentResponse;
import com.resqnet.incident.exception.ApiException;
import com.resqnet.incident.messaging.IncidentEvent;
import com.resqnet.incident.model.IncidentStatus;
import com.resqnet.incident.model.IncidentType;
import com.resqnet.incident.model.Severity;
import com.resqnet.incident.repository.IncidentRepository;
import com.resqnet.incident.security.CurrentUser;
import com.sun.net.httpserver.HttpServer;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Tests the real incident flow with the real circuit breaker (Spring AOP proxy) and a real PostgreSQL
 * (Testcontainers). responder-service is replaced by a tiny fake HTTP server whose behaviour each test
 * chooses: answers, says 409, hangs, returns 500 or is switched off (connection refused).
 */
@SpringBootTest
@Testcontainers
class IncidentFlowTest {

    enum Mode { ASSIGN_OK, CONFLICT, SLOW, SERVER_ERROR }

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    // ---- fake responder-service -------------------------------------------------------------
    static final int STUB_PORT = freePort();
    static final AtomicReference<Mode> mode = new AtomicReference<>(Mode.ASSIGN_OK);
    static final AtomicInteger assignCalls = new AtomicInteger();
    static final AtomicInteger releaseCalls = new AtomicInteger();
    static HttpServer stub;

    /**
     * In production the client calls the NAME "responder-service" through Eureka + the load balancer.
     * Here a plain client aimed at the fake server replaces it (same timeouts); the circuit breaker and
     * fallback under test sit on ResponderClient, not on the HTTP client. The Eureka lookup itself is
     * verified in the real cluster.
     */
    @TestConfiguration
    static class StubResponderClientConfig {
        @Bean
        @Primary
        RestClient stubResponderRestClient() {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(1000);
            factory.setReadTimeout(2000);
            return RestClient.builder().baseUrl("http://localhost:" + STUB_PORT).requestFactory(factory).build();
        }
    }

    @Autowired IncidentService service;
    @Autowired IncidentRepository repository;
    @Autowired CircuitBreakerRegistry breakers;
    @MockitoBean RabbitTemplate rabbit;          // no broker needed: we check what would be sent

    final CurrentUser asha = new CurrentUser(2L, "asha", "USER");
    final CurrentUser ravi = new CurrentUser(3L, "ravi", "USER");
    final CurrentUser admin = new CurrentUser(1L, "admin", "ADMIN");

    @BeforeEach
    void reset() throws IOException {
        startStubIfStopped();
        mode.set(Mode.ASSIGN_OK);
        assignCalls.set(0);
        releaseCalls.set(0);
        breakers.circuitBreaker("responderService").reset();   // every test starts with a CLOSED breaker
        repository.deleteAll();
        org.mockito.Mockito.reset(rabbit);
    }

    @AfterAll
    static void stopStub() {
        if (stub != null) {
            stub.stop(0);
        }
    }

    // ---- tests --------------------------------------------------------------------------------

    @Test
    void responderFound_incidentIsAssigned() {
        IncidentResponse r = report(asha);

        assertEquals("ASSIGNED", r.status());
        assertNotNull(r.assignedResponder());
        assertEquals("Ambulance Alpha", r.assignedResponder().name());
        assertEquals("AMBULANCE", r.assignedResponder().type());
        assertEquals(CircuitBreaker.State.CLOSED, breaker().getState());
    }

    // ---- coordinates (used by the incident map in the web UI) ------------------------------

    @Test
    void coordinatesAreStoredAndReturnedWhenReportingAndWhenReadingBack() {
        IncidentResponse created = service.create(asha, new CreateIncidentRequest(IncidentType.FIRE, Severity.MEDIUM,
                "Smoke from a shop", "100 Feet Road, Indiranagar", new java.math.BigDecimal("12.978400"), new java.math.BigDecimal("77.640800")));

        assertEquals(0, new java.math.BigDecimal("12.978400").compareTo(created.latitude()));
        assertEquals(0, new java.math.BigDecimal("77.640800").compareTo(created.longitude()));

        IncidentResponse readBack = service.get(asha, created.id());          // what GET /incidents/{id} returns
        assertEquals(0, new java.math.BigDecimal("12.978400").compareTo(readBack.latitude()));
        assertEquals(0, new java.math.BigDecimal("77.640800").compareTo(readBack.longitude()));
        assertTrue(service.list(asha, null).stream().anyMatch(i -> i.id().equals(created.id()) && i.latitude() != null),
                "the list endpoint must carry the coordinates too");
    }

    @Test
    void reportingWithoutCoordinatesStillWorksAndReturnsNulls() {
        IncidentResponse r = report(asha);                                      // report() sends no coordinates

        assertNull(r.latitude());
        assertNull(r.longitude());
        assertNull(service.get(asha, r.id()).latitude());
    }

    @Test
    void noResponderAvailable409_incidentIsPending_andBreakerIsNotAffected() {
        mode.set(Mode.CONFLICT);

        for (int i = 0; i < 5; i++) {
            IncidentResponse r = report(asha);
            assertEquals("PENDING", r.status());
            assertNull(r.assignedResponder());
        }

        assertEquals(CircuitBreaker.State.CLOSED, breaker().getState());     // 409 is not a failure (R-RS-2)
        assertEquals(0, breaker().getMetrics().getNumberOfFailedCalls());
    }

    @Test
    void responderDown_connectionRefused_incidentIsPendingAndFast() {
        stub.stop(0);                                    // nobody listens any more

        long start = System.currentTimeMillis();
        IncidentResponse r = report(asha);
        long elapsed = System.currentTimeMillis() - start;

        assertEquals("PENDING", r.status());
        assertTrue(elapsed < 3000, "fallback must be fast, took " + elapsed + " ms");
        assertEquals(IncidentStatus.PENDING, repository.findById(r.id()).orElseThrow().getStatus());
    }

    @Test
    void responderHangs_readTimeoutTriggersFallbackWithinAboutThreeSeconds() {
        mode.set(Mode.SLOW);                             // fake answers only after 3 s; read timeout is 2 s

        long start = System.currentTimeMillis();
        IncidentResponse r = report(asha);
        long elapsed = System.currentTimeMillis() - start;

        assertEquals("PENDING", r.status());
        assertTrue(elapsed < 3000, "must give up after the 2 s read timeout, took " + elapsed + " ms");
    }

    @Test
    void responderReturns500_incidentIsPending() {
        mode.set(Mode.SERVER_ERROR);

        assertEquals("PENDING", report(asha).status());
    }

    @Test
    void repeatedFailuresOpenTheBreaker_thenCallsAreNotEvenAttempted() {
        mode.set(Mode.SERVER_ERROR);
        for (int i = 0; i < 3; i++) {                    // minimum-number-of-calls = 3, all failing
            report(asha);
        }
        assertEquals(CircuitBreaker.State.OPEN, breaker().getState());

        int callsBefore = assignCalls.get();
        mode.set(Mode.ASSIGN_OK);                        // even a healthy responder is not asked while OPEN
        IncidentResponse r = report(asha);

        assertEquals("PENDING", r.status());
        assertEquals(callsBefore, assignCalls.get(), "no request may reach responder-service while the breaker is open");
    }

    @Test
    void dispatchAssignsAPendingIncidentOnceTheResponderIsBack() {
        mode.set(Mode.CONFLICT);
        IncidentResponse pending = report(asha);
        assertEquals("PENDING", pending.status());

        mode.set(Mode.ASSIGN_OK);
        IncidentResponse dispatched = service.dispatch(admin, pending.id());

        assertEquals("ASSIGNED", dispatched.status());
        assertEquals("Ambulance Alpha", dispatched.assignedResponder().name());
    }

    @Test
    void dispatchOfANonPendingIncidentIs409InvalidState() {
        IncidentResponse assigned = report(asha);

        ApiException ex = assertThrows(ApiException.class, () -> service.dispatch(admin, assigned.id()));

        assertEquals("INVALID_STATE", ex.getCode());
    }

    @Test
    void resolveReleasesTheResponderAndKeepsItForHistory() {
        IncidentResponse assigned = report(asha);

        IncidentResponse resolved = service.resolve(admin, assigned.id());

        assertEquals("RESOLVED", resolved.status());
        assertNotNull(resolved.resolvedAt());
        assertNotNull(resolved.assignedResponder());
        assertEquals(1, releaseCalls.get());
    }

    @Test
    void resolveWhileResponderIsDown_is503AndStateUnchanged() {
        IncidentResponse assigned = report(asha);
        stub.stop(0);

        ApiException ex = assertThrows(ApiException.class, () -> service.resolve(admin, assigned.id()));

        assertEquals(503, ex.getStatus().value());
        assertEquals("SERVICE_UNAVAILABLE", ex.getCode());
        assertEquals(IncidentStatus.ASSIGNED, repository.findById(assigned.id()).orElseThrow().getStatus());
    }

    @Test
    void userCannotDispatchOrResolve_403() {
        IncidentResponse r = report(asha);

        assertEquals("FORBIDDEN", assertThrows(ApiException.class, () -> service.dispatch(asha, r.id())).getCode());
        assertEquals("FORBIDDEN", assertThrows(ApiException.class, () -> service.resolve(asha, r.id())).getCode());
    }

    @Test
    void usersSeeOnlyTheirOwnIncidents_adminSeesAll_otherUsersGet403() {
        IncidentResponse ashas = report(asha);
        report(ravi);

        assertEquals(1, service.list(asha, null).size());
        assertEquals(2, service.list(admin, null).size());
        assertEquals(2, service.list(admin, IncidentStatus.ASSIGNED).size());       // status filter
        assertEquals("FORBIDDEN", assertThrows(ApiException.class, () -> service.get(ravi, ashas.id())).getCode());
        assertEquals(ashas.id(), service.get(admin, ashas.id()).id());
    }

    @Test
    void unknownIncidentIs404() {
        assertEquals("NOT_FOUND", assertThrows(ApiException.class, () -> service.get(admin, 999999L)).getCode());
    }

    // ---- events (asynchronous communication) ---------------------------------------------------

    @Test
    void assignedIncidentPublishesIncidentAssignedEvent() {
        IncidentResponse r = report(asha);

        IncidentEvent e = publishedEvent("incident.assigned");
        assertEquals("INCIDENT_ASSIGNED", e.eventType());
        assertEquals(r.id(), e.incidentId());
        assertEquals(2L, e.userId());
        assertEquals("asha", e.username());
        assertEquals("MEDICAL", e.incidentType());
        assertEquals("CRITICAL", e.severity());
        assertEquals("ASSIGNED", e.status());
        assertEquals("Ambulance Alpha", e.responder().name());
        assertNotNull(e.eventId());
    }

    @Test
    void noResponder409PublishesIncidentPendingEvent() {
        mode.set(Mode.CONFLICT);

        report(asha);

        IncidentEvent e = publishedEvent("incident.pending");
        assertEquals("INCIDENT_PENDING", e.eventType());
        assertEquals("PENDING", e.status());
        assertNull(e.responder());
    }

    @Test
    void responderDownPublishesIncidentPendingEvent() {
        stub.stop(0);

        report(asha);

        assertEquals("INCIDENT_PENDING", publishedEvent("incident.pending").eventType());
    }

    @Test
    void everyEventHasItsOwnEventId() {
        report(asha);
        report(asha);

        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(rabbit, org.mockito.Mockito.times(2)).convertAndSend(eq("resqnet.events"), anyString(), captor.capture());
        assertTrue(!((IncidentEvent) captor.getAllValues().get(0)).eventId()
                .equals(((IncidentEvent) captor.getAllValues().get(1)).eventId()));
    }

    @Test
    void brokerFailureNeverFailsTheIncidentRequest() {
        doThrow(new org.springframework.amqp.AmqpConnectException(new java.net.ConnectException("rabbit down")))
                .when(rabbit).convertAndSend(anyString(), anyString(), any(Object.class));

        IncidentResponse r = report(asha);                       // must still return 201-style success

        assertEquals("ASSIGNED", r.status());
        assertEquals(IncidentStatus.ASSIGNED, repository.findById(r.id()).orElseThrow().getStatus());
    }

    @Test
    void successfulDispatchPublishesAssignedButFailedDispatchPublishesNothing() {
        mode.set(Mode.CONFLICT);
        IncidentResponse pending = report(asha);
        org.mockito.Mockito.reset(rabbit);

        service.dispatch(admin, pending.id());                    // still no responder -> still PENDING
        verify(rabbit, never()).convertAndSend(anyString(), anyString(), any(Object.class));

        mode.set(Mode.ASSIGN_OK);
        service.dispatch(admin, pending.id());                    // now it works
        assertEquals("INCIDENT_ASSIGNED", publishedEvent("incident.assigned").eventType());
    }

    private IncidentEvent publishedEvent(String routingKey) {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(rabbit).convertAndSend(eq("resqnet.events"), eq(routingKey), captor.capture());
        return (IncidentEvent) captor.getValue();
    }

    // ---- helpers ------------------------------------------------------------------------------

    private IncidentResponse report(CurrentUser user) {
        return service.create(user, new CreateIncidentRequest(IncidentType.MEDICAL, Severity.CRITICAL,
                "Person collapsed near library", "Main Library, Gate 2", null, null));
    }

    private CircuitBreaker breaker() {
        return breakers.circuitBreaker("responderService");
    }

    private static int freePort() {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void startStubIfStopped() throws IOException {
        if (stub != null && stubRunning()) {
            return;
        }
        stub = HttpServer.create(new InetSocketAddress("localhost", STUB_PORT), 0);
        stub.setExecutor(Executors.newCachedThreadPool());     // a hanging request must not block the others
        stub.createContext("/internal/responders/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            exchange.getRequestBody().readAllBytes();
            int status = 200;
            String body;
            if (path.endsWith("/assign")) {
                assignCalls.incrementAndGet();
                switch (mode.get()) {
                    case CONFLICT -> { status = 409; body = "{\"code\":\"NO_RESPONDER_AVAILABLE\"}"; }
                    case SERVER_ERROR -> { status = 500; body = "{}"; }
                    case SLOW -> {
                        try { Thread.sleep(3000); } catch (InterruptedException ignored) { }
                        body = "{\"responderId\":1,\"name\":\"Ambulance Alpha\",\"type\":\"AMBULANCE\"}";
                    }
                    default -> body = "{\"responderId\":1,\"name\":\"Ambulance Alpha\",\"type\":\"AMBULANCE\"}";
                }
            } else {
                releaseCalls.incrementAndGet();
                body = "{\"responderId\":1,\"status\":\"AVAILABLE\"}";
            }
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            try {
                exchange.sendResponseHeaders(status, bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch (IOException ignored) {
                // the client may already have given up (read timeout) - that is the point of the SLOW test
            } finally {
                exchange.close();
            }
        });
        stub.start();
    }

    private static boolean stubRunning() {
        try (java.net.Socket s = new java.net.Socket()) {
            s.connect(new InetSocketAddress("localhost", STUB_PORT), 200);
            return true;
        } catch (IOException e) {
            return false;
        }
    }
}

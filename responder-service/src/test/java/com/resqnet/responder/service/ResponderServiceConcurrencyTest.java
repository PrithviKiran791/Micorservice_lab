package com.resqnet.responder.service;

import com.resqnet.responder.dto.AssignRequest;
import com.resqnet.responder.dto.AssignResponse;
import com.resqnet.responder.dto.ReleaseRequest;
import com.resqnet.responder.exception.ApiException;
import com.resqnet.responder.model.IncidentType;
import com.resqnet.responder.model.Responder;
import com.resqnet.responder.model.ResponderStatus;
import com.resqnet.responder.repository.ResponderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs against a REAL PostgreSQL (started in a throw-away Docker container) because the
 * guarantee under test, "SELECT ... FOR UPDATE SKIP LOCKED", only exists in a real database.
 * The application seeds 3 ambulances, 3 fire trucks and 3 police units at start-up.
 */
@SpringBootTest
@Testcontainers
class ResponderServiceConcurrencyTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Autowired
    ResponderService service;

    @Autowired
    ResponderRepository repository;

    @BeforeEach
    void resetResponders() {
        // put every responder back to AVAILABLE so tests do not depend on each other
        List<Responder> all = repository.findAll();
        all.forEach(r -> { if (r.getStatus() == ResponderStatus.BUSY) { r.release(); } });
        repository.saveAllAndFlush(all);
    }

    @Test
    void concurrentAssignmentsNeverGiveTheSameResponder() throws Exception {
        int requests = 10;                       // 10 incidents compete for only 3 ambulances
        ExecutorService pool = Executors.newFixedThreadPool(requests);
        CountDownLatch startTogether = new CountDownLatch(1);

        List<Future<AssignResponse>> futures = new ArrayList<>();
        for (int i = 0; i < requests; i++) {
            long incidentId = 1000 + i;
            Callable<AssignResponse> task = () -> {
                startTogether.await();           // release all threads at the same instant
                return service.assign(new AssignRequest(incidentId, IncidentType.MEDICAL, "CRITICAL"));
            };
            futures.add(pool.submit(task));
        }
        startTogether.countDown();

        Set<Long> responderIds = new HashSet<>();
        int assigned = 0;
        int refused = 0;
        for (Future<AssignResponse> f : futures) {
            try {
                assertTrue(responderIds.add(f.get().responderId()), "responder handed out twice!");
                assigned++;
            } catch (java.util.concurrent.ExecutionException e) {
                ApiException api = (ApiException) e.getCause();
                assertEquals("NO_RESPONDER_AVAILABLE", api.getCode());
                refused++;
            }
        }
        pool.shutdown();

        assertEquals(3, assigned, "exactly the 3 ambulances should be assigned");
        assertEquals(7, refused);
        assertEquals(3, repository.findByStatusOrderByIdAsc(ResponderStatus.BUSY).size());
    }

    @Test
    void assignIsIdempotentPerIncident() {
        AssignRequest request = new AssignRequest(2001L, IncidentType.FIRE, "MEDIUM");

        AssignResponse first = service.assign(request);
        AssignResponse second = service.assign(request);        // a retried call

        assertEquals(first.responderId(), second.responderId());
        assertEquals(1, repository.findByStatusOrderByIdAsc(ResponderStatus.BUSY).size());
    }

    @Test
    void releaseFreesTheResponderAndIsIdempotent() {
        AssignResponse a = service.assign(new AssignRequest(3001L, IncidentType.POLICE, "LOW"));

        assertEquals("AVAILABLE", service.release(a.responderId(), new ReleaseRequest(3001L)).status());
        assertEquals("AVAILABLE", service.release(a.responderId(), new ReleaseRequest(3001L)).status());
        assertEquals(0, repository.findByStatusOrderByIdAsc(ResponderStatus.BUSY).size());
    }

    @Test
    void releaseForADifferentIncidentIsRefused() {
        AssignResponse a = service.assign(new AssignRequest(4001L, IncidentType.POLICE, "LOW"));

        ApiException ex = assertThrows(ApiException.class,
                () -> service.release(a.responderId(), new ReleaseRequest(9999L)));

        assertEquals("INVALID_STATE", ex.getCode());
    }
}

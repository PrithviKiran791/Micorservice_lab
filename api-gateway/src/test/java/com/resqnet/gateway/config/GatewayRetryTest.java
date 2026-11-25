package com.resqnet.gateway.config;

import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The real gateway (real load balancer, real retry filter) with TWO registered copies of incident-service:
 * one is dead (nobody listens on its port), one is a tiny fake server that answers 200.
 * This is exactly the situation right after a pod dies, before the registry has noticed.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "eureka.client.enabled=false",
        "jwt.secret=test-secret-test-secret-test-secret-123"})
class GatewayRetryTest {

    static final int DEAD_PORT = freePort();
    static final int LIVE_PORT = freePort();
    static final AtomicInteger liveGets = new AtomicInteger();
    static final AtomicInteger livePosts = new AtomicInteger();
    static HttpServer live;

    @DynamicPropertySource
    static void discovery(DynamicPropertyRegistry registry) throws IOException {
        // "Service discovery" for the test: the two copies of incident-service.
        registry.add("spring.cloud.discovery.client.simple.instances.incident-service[0].uri", () -> "http://localhost:" + DEAD_PORT);
        registry.add("spring.cloud.discovery.client.simple.instances.incident-service[1].uri", () -> "http://localhost:" + LIVE_PORT);
        live = HttpServer.create(new InetSocketAddress("localhost", LIVE_PORT), 0);
        live.createContext("/incidents", exchange -> {
            if ("GET".equals(exchange.getRequestMethod())) { liveGets.incrementAndGet(); } else { livePosts.incrementAndGet(); }
            exchange.getRequestBody().readAllBytes();
            byte[] body = "[]".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        live.start();
    }

    @AfterAll
    static void stop() {
        live.stop(0);
    }

    @Autowired
    WebTestClient client;

    @BeforeEach
    void resetCounters() {
        liveGets.set(0);
        livePosts.set(0);
    }

    @Test
    void getRequestsSucceedEvenThoughOneCopyIsDead() {
        int requests = 12;                                  // round-robin sends about half of them to the dead copy first
        for (int i = 0; i < requests; i++) {
            client.get().uri("/api/incidents").header("Authorization", "Bearer " + token())
                    .exchange()
                    .expectStatus().isOk();                 // the retry moved the request to the healthy copy
        }
        assertEquals(requests, liveGets.get(), "every GET must end up answered by the live copy");
    }

    @Test
    void postRequestsAreNeverRetried() {
        int requests = 12;
        int ok = 0;
        int unavailable = 0;
        for (int i = 0; i < requests; i++) {
            int status = client.post().uri("/api/incidents").header("Authorization", "Bearer " + token())
                    .header("Content-Type", "application/json").bodyValue("{}")
                    .exchange().returnResult(String.class).getStatus().value();
            if (status == 200) { ok++; } else if (status == 503) { unavailable++; }
        }
        assertEquals(requests, ok + unavailable);
        assertTrue(unavailable >= 1, "a POST that hit the dead copy must fail (503), not be repeated");
        assertEquals(ok, livePosts.get(), "the live copy received each successful POST exactly once");
    }

    private static String token() {
        return Jwts.builder().issuer("resqnet-auth").subject("2").claim("username", "asha").claim("role", "USER")
                .issuedAt(new Date()).expiration(Date.from(Instant.now().plusSeconds(600)))
                .signWith(Keys.hmacShaKeyFor("test-secret-test-secret-test-secret-123".getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    private static int freePort() {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}

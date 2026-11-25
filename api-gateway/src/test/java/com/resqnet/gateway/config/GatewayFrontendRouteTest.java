package com.resqnet.gateway.config;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
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
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The real gateway in front of a tiny fake "frontend" server: the web UI is served without a token,
 * but the security rules of everything else are unchanged.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "eureka.client.enabled=false",
        "jwt.secret=test-secret-test-secret-test-secret-123"})
class GatewayFrontendRouteTest {

    static final int FRONTEND_PORT = freePort();
    static final List<String> requestedByGateway = new CopyOnWriteArrayList<>();
    static HttpServer frontend;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) throws IOException {
        registry.add("frontend.url", () -> "http://localhost:" + FRONTEND_PORT);
        frontend = HttpServer.create(new InetSocketAddress("localhost", FRONTEND_PORT), 0);
        frontend.createContext("/", exchange -> {
            requestedByGateway.add(exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath());
            byte[] body = "<html>resqnet-ui</html>".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/html");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        frontend.start();
    }

    @AfterAll
    static void stop() {
        frontend.stop(0);
    }

    @Autowired
    WebTestClient client;

    @Test
    void pageAndStaticFilesAreServedWithoutAToken() {
        client.get().uri("/").exchange().expectStatus().isOk()
                .expectBody(String.class).value(b -> assertTrue(b.contains("resqnet-ui")));
        client.get().uri("/assets/index-abc.js").exchange().expectStatus().isOk();
    }

    @Test
    void clientSideRoutesAreForwardedUnchangedSoTheSinglePageAppCanHandleThem() {
        requestedByGateway.clear();
        client.get().uri("/app/incidents").exchange().expectStatus().isOk();
        assertEquals(List.of("GET /app/incidents"), requestedByGateway);
    }

    @Test
    void apiStillNeedsAToken() {
        client.get().uri("/api/incidents").exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/auth/me").exchange().expectStatus().isUnauthorized();
    }

    @Test
    void unknownApiPathsAreNeverAnsweredByTheFrontend() {
        requestedByGateway.clear();
        client.get().uri("/api/nothing-here").exchange().expectStatus().isNotFound();
        assertTrue(requestedByGateway.isEmpty(), "the UI server must not see /api requests");
    }

    @Test
    void internalEndpointsAreStillNotReachable() {
        requestedByGateway.clear();
        client.get().uri("/internal/responders/assign").exchange().expectStatus().isNotFound();
        client.post().uri("/internal/responders/assign").exchange().expectStatus().isNotFound();
        assertTrue(requestedByGateway.isEmpty());
    }

    @Test
    void onlyReadingIsAllowedOnTheUiRoute() {
        requestedByGateway.clear();
        client.post().uri("/anything").exchange().expectStatus().isNotFound();
        client.delete().uri("/anything").exchange().expectStatus().isNotFound();
        assertTrue(requestedByGateway.isEmpty());
    }

    @Test
    void forgedIdentityHeadersDoNotReachTheUiServer() {
        client.get().uri("/").header("X-User-Role", "ADMIN").exchange().expectStatus().isOk();
    }

    private static int freePort() {
        try (ServerSocket s = new ServerSocket(0)) {
            return s.getLocalPort();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}

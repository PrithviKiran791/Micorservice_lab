package com.resqnet.gateway.ops;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The operations API against fake infrastructure: a fake Eureka registry, a fake service (health, circuit breaker,
 * metrics) behind two registrations (one alive, one dead port) and a fake Kubernetes API.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "eureka.client.enabled=false",
        "jwt.secret=test-secret-test-secret-test-secret-123"})
class OpsApiTest {

    static final String SECRET = "test-secret-test-secret-test-secret-123";
    static final int EUREKA_PORT = freePort();
    static final int SERVICE_PORT = freePort();
    static final int DEAD_PORT = freePort();
    static final int K8S_PORT = freePort();
    static HttpServer eureka;
    static HttpServer service;
    static HttpServer k8s;
    static Path tokenFile;
    static final ObjectMapper mapper = new ObjectMapper();

    @DynamicPropertySource
    static void infrastructure(DynamicPropertyRegistry registry) throws IOException {
        // fake Eureka: incident-service has two registrations (one alive, one dead); auth-service one; responder-service none
        eureka = HttpServer.create(new InetSocketAddress("127.0.0.1", EUREKA_PORT), 0);
        eureka.createContext("/eureka/apps", e -> json(e, 200, """
                {"applications":{"versions__delta":"1","apps__hashcode":"UP_3_","application":[
                  {"name":"INCIDENT-SERVICE","instance":[
                    {"instanceId":"incident-1","app":"INCIDENT-SERVICE","ipAddr":"127.0.0.1","status":"UP","port":{"$":%d,"@enabled":"true"}},
                    {"instanceId":"incident-2","app":"INCIDENT-SERVICE","ipAddr":"127.0.0.1","status":"UP","port":{"$":%d,"@enabled":"true"}}]},
                  {"name":"AUTH-SERVICE","instance":{"instanceId":"auth-1","app":"AUTH-SERVICE","ipAddr":"127.0.0.1","status":"UP","port":{"$":%d,"@enabled":"true"}}}
                ]}}""".formatted(SERVICE_PORT, DEAD_PORT, SERVICE_PORT)));
        eureka.createContext("/actuator/health", e -> json(e, 200, "{\"status\":\"UP\"}"));
        eureka.start();

        service = HttpServer.create(new InetSocketAddress("127.0.0.1", SERVICE_PORT), 0);
        service.createContext("/actuator/health", e -> json(e, 200,
                "{\"status\":\"UP\",\"components\":{\"db\":{\"status\":\"UP\"},\"rabbit\":{\"status\":\"UP\"},\"ping\":{\"status\":\"UP\"}}}"));
        service.createContext("/actuator/circuitbreakers", e -> json(e, 200,
                "{\"circuitBreakers\":{\"responderService\":{\"state\":\"CLOSED\",\"failureRate\":\"-1.0%\",\"bufferedCalls\":2,\"failedCalls\":0,\"notPermittedCalls\":0}}}"));
        service.createContext("/actuator/circuitbreakerevents", e -> json(e, 200,
                "{\"circuitBreakerEvents\":[{\"circuitBreakerName\":\"responderService\",\"type\":\"SUCCESS\",\"creationTime\":\"2026-11-25T10:00:00+05:30[Asia/Calcutta]\"},"
                + "{\"circuitBreakerName\":\"responderService\",\"type\":\"STATE_TRANSITION\",\"creationTime\":\"2026-11-25T10:01:00+05:30[Asia/Calcutta]\",\"stateTransition\":\"CLOSED_TO_OPEN\"}]}"));
        service.createContext("/actuator/metrics/http.server.requests", e -> {
            String query = e.getRequestURI().getRawQuery();
            if (query == null) {
                json(e, 200, "{\"name\":\"http.server.requests\",\"measurements\":[{\"statistic\":\"COUNT\",\"value\":99.0}]}");
            } else if (query.contains("uri:/incidents") && !query.contains("%7Bid%7D")) {
                json(e, 200, "{\"name\":\"http.server.requests\",\"measurements\":[{\"statistic\":\"COUNT\",\"value\":7.0}]}");
            } else {
                json(e, 404, "{\"error\":\"no such meter\"}");
            }
        });
        service.start();

        // fake Kubernetes API (plain http) with a token file; the pod JSON also carries an env section that must NOT be copied
        tokenFile = Files.createTempFile("k8s-token", ".txt");
        Files.writeString(tokenFile, "fake-service-account-token");
        k8s = HttpServer.create(new InetSocketAddress("127.0.0.1", K8S_PORT), 0);
        k8s.createContext("/apis/apps/v1/namespaces/resqnet/deployments", e -> json(e, 200, """
                {"items":[{"metadata":{"name":"incident-service"},"spec":{"replicas":2,"template":{"spec":{"containers":[
                  {"image":"resqnet/incident-service:1.0","env":[{"name":"DB_PASSWORD","value":"SECRET-VALUE"}]}]}}},
                  "status":{"readyReplicas":2,"availableReplicas":2,"updatedReplicas":2}}]}"""));
        k8s.createContext("/api/v1/namespaces/resqnet/pods", e -> json(e, 200, """
                {"items":[{"metadata":{"name":"incident-service-abc","labels":{"app":"incident-service"}},
                  "status":{"phase":"Running","startTime":"2026-11-25T10:00:00Z","containerStatuses":[{"ready":true,"restartCount":1}]}}]}"""));
        k8s.createContext("/api/v1/namespaces/resqnet/services", e -> json(e, 200, """
                {"items":[{"metadata":{"name":"api-gateway"},"spec":{"type":"NodePort","ports":[{"port":8080,"nodePort":30080}]}}]}"""));
        k8s.start();

        registry.add("eureka.client.service-url.defaultZone", () -> "http://127.0.0.1:" + EUREKA_PORT + "/eureka");
        registry.add("ops.kubernetes.api-url", () -> "http://127.0.0.1:" + K8S_PORT);
        registry.add("ops.kubernetes.token-file", () -> tokenFile.toString());
    }

    @AfterAll
    static void stop() {
        eureka.stop(0);
        service.stop(0);
        k8s.stop(0);
    }

    @Autowired
    WebTestClient client;

    // ---------------------------------------------------------------------------------------- security

    @Test
    void everyOpsEndpointRejectsMissingAndBadTokensWith401() {
        for (String path : new String[]{"health", "resilience", "traffic", "kubernetes"}) {
            client.get().uri("/api/ops/" + path).exchange().expectStatus().isUnauthorized();
            client.get().uri("/api/ops/" + path).header("Authorization", "Bearer not.a.jwt").exchange().expectStatus().isUnauthorized();
            client.get().uri("/api/ops/" + path).header("Authorization", "Bearer " + token("ADMIN", Instant.now().minusSeconds(60))).exchange().expectStatus().isUnauthorized();
        }
    }

    @Test
    void aRegularUserGets403() {
        for (String path : new String[]{"health", "resilience", "traffic", "kubernetes"}) {
            client.get().uri("/api/ops/" + path).header("Authorization", "Bearer " + userToken()).exchange()
                    .expectStatus().isForbidden()
                    .expectBody().jsonPath("$.code").isEqualTo("FORBIDDEN");
        }
    }

    @Test
    void unknownOpsPathsAreNotFound() {
        client.get().uri("/api/ops/secrets").header("Authorization", "Bearer " + adminToken()).exchange().expectStatus().isNotFound();
    }

    // ---------------------------------------------------------------------------------------- health

    @Test
    void healthShowsRealStatesAndNeverGuesses() {
        JsonNode body = get("health");

        JsonNode incident = service(body, "incident-service");
        assertEquals("DEGRADED", incident.get("status").asText());            // one registration answers, the other is dead
        assertEquals(2, incident.get("registeredInstances").asInt());
        assertEquals(1, incident.get("healthyInstances").asInt());
        assertEquals("UNREACHABLE", incident.get("instances").get(1).get("health").asText());
        assertNotNull(incident.get("lastHealthyAt").asText(null));

        JsonNode auth = service(body, "auth-service");
        assertEquals("UP", auth.get("status").asText());
        assertEquals("UP", auth.get("instances").get(0).get("components").get("db").asText());

        JsonNode responder = service(body, "responder-service");               // nothing registered
        assertEquals("DOWN", responder.get("status").asText());
        assertTrue(responder.get("reason").asText().contains("No instance is registered"));
        assertTrue(responder.get("lastHealthyAt").isNull());

        assertEquals("UP", body.at("/discovery/health").asText());
        assertTrue(body.at("/discovery/registryReadable").asBoolean());
        assertEquals(2, body.at("/discovery/registeredApplications/0/instances").asInt());

        assertEquals("UP", database(body, "incident_db").get("status").asText());
        assertEquals("UNKNOWN", database(body, "responder_db").get("status").asText());      // service down: unknown, not "UP"
        assertEquals("UNKNOWN", body.at("/rabbitmq/status").asText());                        // notification-service not reporting
    }

    @Test
    void healthDoesNotLeakSecretsOrTokens() {
        String text = get("health").toString().toLowerCase();
        assertFalse(text.contains("password"));
        assertFalse(text.contains("secret"));
        assertFalse(text.contains("bearer"));
    }

    // ---------------------------------------------------------------------------------------- resilience and traffic

    @Test
    void resilienceReportsTheBreakerStateOfEveryIncidentInstance() {
        JsonNode body = get("resilience");
        JsonNode instances = body.get("instances");
        assertEquals(2, instances.size());
        JsonNode alive = null;
        JsonNode dead = null;
        for (JsonNode i : instances) {
            if (i.get("available").asBoolean()) { alive = i; } else { dead = i; }
        }
        assertNotNull(alive);
        assertNotNull(dead);
        assertEquals("CLOSED", alive.at("/circuitBreakers/responderService/state").asText());
        assertEquals("CLOSED_TO_OPEN", alive.at("/events/0/stateTransition").asText());   // newest first
        assertEquals("instance unreachable", dead.get("reason").asText());
    }

    @Test
    void trafficCountsRequestsPerInstanceAndTreatsNoMeterAsZero() {
        JsonNode body = get("traffic");
        JsonNode aliveIncident = null;
        for (JsonNode i : body.get("instances")) {
            if (i.get("service").asText().equals("incident-service") && i.get("available").asBoolean()) {
                aliveIncident = i;
            }
        }
        assertNotNull(aliveIncident);
        assertEquals(7, aliveIncident.at("/requests/~1incidents").asInt());
        assertEquals(0, aliveIncident.at("/requests/~1incidents~1{id}").asInt());
    }

    // ---------------------------------------------------------------------------------------- kubernetes

    @Test
    void kubernetesViewCopiesOnlyHarmlessFields() {
        JsonNode body = get("kubernetes");
        assertTrue(body.get("available").asBoolean());
        assertEquals(2, body.at("/deployments/0/desired").asInt());
        assertEquals(2, body.at("/deployments/0/ready").asInt());
        assertEquals("resqnet/incident-service:1.0", body.at("/deployments/0/image").asText());
        assertEquals(1, body.at("/pods/0/restarts").asInt());
        assertTrue(body.at("/pods/0/ready").asBoolean());
        assertEquals(30080, body.at("/services/0/ports/0/nodePort").asInt());
        assertFalse(body.toString().contains("SECRET-VALUE"), "environment variables must never be copied");
        assertFalse(body.toString().contains("fake-service-account-token"), "the token must never be returned");
    }

    @Test
    void kubernetesReaderOutsideAClusterReportsUnavailableInsteadOfFailing() {
        KubernetesReader reader = new KubernetesReader(mapper, "/does/not/exist/token", "/does/not/exist/ca.crt", "resqnet", "");
        JsonNode result = reader.read().block();
        assertNotNull(result);
        assertFalse(result.get("available").asBoolean());
        assertTrue(result.get("reason").asText().contains("not running inside a Kubernetes cluster"));
    }

    // ---------------------------------------------------------------------------------------- helpers

    private JsonNode get(String path) {
        return client.get().uri("/api/ops/" + path).header("Authorization", "Bearer " + adminToken())
                .exchange().expectStatus().isOk().expectBody(JsonNode.class).returnResult().getResponseBody();
    }

    private static JsonNode service(JsonNode body, String name) {
        for (JsonNode s : body.get("services")) {
            if (s.get("name").asText().equals(name)) {
                return s;
            }
        }
        throw new AssertionError("service not in answer: " + name);
    }

    private static JsonNode database(JsonNode body, String name) {
        for (JsonNode d : body.get("databases")) {
            if (d.get("database").asText().equals(name)) {
                return d;
            }
        }
        throw new AssertionError("database not in answer: " + name);
    }

    private String adminToken() {
        return token("ADMIN", Instant.now().plusSeconds(600));
    }

    private String userToken() {
        return token("USER", Instant.now().plusSeconds(600));
    }

    private String token(String role, Instant expiry) {
        return Jwts.builder().issuer("resqnet-auth").subject("1").claim("username", "tester").claim("role", role)
                .issuedAt(Date.from(Instant.now().minusSeconds(120))).expiration(Date.from(expiry))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    }

    private static void json(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static int freePort() {
        try (ServerSocket s = new ServerSocket(0)) {
            return s.getLocalPort();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}

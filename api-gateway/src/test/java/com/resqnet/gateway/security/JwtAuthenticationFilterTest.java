package com.resqnet.gateway.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests the JWT filter in isolation: a fake "chain" records whether the request was
 * passed on (reached a service) and with which headers.
 */
class JwtAuthenticationFilterTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-123";
    private static final String ISSUER = "resqnet-auth";

    private JwtAuthenticationFilter filter;
    private final AtomicReference<ServerHttpRequest> forwarded = new AtomicReference<>();
    private final GatewayFilterChain chain = exchange -> {
        forwarded.set(exchange.getRequest());
        return Mono.empty();
    };

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(SECRET, ISSUER);
    }

    @Test
    void missingTokenIsRejectedWith401AndNeverForwarded() {
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/incidents", null);

        filter.filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertNull(forwarded.get());
        String body = exchange.getResponse().getBodyAsString().block();
        assertTrue(body.contains("\"code\":\"UNAUTHORIZED\""));
    }

    @Test
    void garbageTokenIsRejected() {
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/incidents", "Bearer not.a.jwt");

        filter.filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertNull(forwarded.get());
    }

    @Test
    void nonBearerSchemeIsRejected() {
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/incidents", "Basic abc");

        filter.filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
    }

    @Test
    void expiredTokenIsRejected() {
        String token = token(SECRET, ISSUER, "USER", Instant.now().minusSeconds(60));
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/incidents", "Bearer " + token);

        filter.filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertNull(forwarded.get());
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        String token = token("another-secret-another-secret-another-1", ISSUER, "USER", Instant.now().plusSeconds(600));
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/incidents", "Bearer " + token);

        filter.filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertNull(forwarded.get());
    }

    @Test
    void tokenWithWrongIssuerIsRejected() {
        String token = token(SECRET, "someone-else", "USER", Instant.now().plusSeconds(600));
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/incidents", "Bearer " + token);

        filter.filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
    }

    @Test
    void tokenWithUnknownRoleIsRejected() {
        String token = token(SECRET, ISSUER, "SUPERUSER", Instant.now().plusSeconds(600));
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/incidents", "Bearer " + token);

        filter.filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
    }

    @Test
    void validTokenIsForwardedWithTrustedIdentityHeaders() {
        String token = token(SECRET, ISSUER, "USER", Instant.now().plusSeconds(600));
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/incidents", "Bearer " + token);

        filter.filter(exchange, chain).block();

        assertNotNull(forwarded.get());
        assertEquals("2", forwarded.get().getHeaders().getFirst("X-User-Id"));
        assertEquals("asha", forwarded.get().getHeaders().getFirst("X-User-Name"));
        assertEquals("USER", forwarded.get().getHeaders().getFirst("X-User-Role"));
    }

    @Test
    void forgedIdentityHeadersAreReplacedByVerifiedOnes() {
        String token = token(SECRET, ISSUER, "USER", Instant.now().plusSeconds(600));
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/incidents")
                .header("Authorization", "Bearer " + token)
                .header("X-User-Role", "ADMIN")        // forged by the client
                .header("X-User-Id", "999")
                .build();

        filter.filter(MockServerWebExchange.from(request), chain).block();

        assertEquals("USER", forwarded.get().getHeaders().getFirst("X-User-Role"));
        assertEquals(1, forwarded.get().getHeaders().get("X-User-Role").size());
        assertEquals("2", forwarded.get().getHeaders().getFirst("X-User-Id"));
    }

    @Test
    void forgedHeadersAreStrippedOnPublicRoutesToo() {
        MockServerHttpRequest request = MockServerHttpRequest.post("/api/auth/login")
                .header("X-User-Role", "ADMIN")
                .build();

        filter.filter(MockServerWebExchange.from(request), chain).block();

        assertNotNull(forwarded.get());                       // public: passed on without a token
        assertNull(forwarded.get().getHeaders().getFirst("X-User-Role"));
    }

    @Test
    void loginAndRegisterArePublicButOtherAuthPathsAreNot() {
        filter.filter(exchange(HttpMethod.POST, "/api/auth/login", null), chain).block();
        assertNotNull(forwarded.get());
        forwarded.set(null);

        filter.filter(exchange(HttpMethod.POST, "/api/auth/register", null), chain).block();
        assertNotNull(forwarded.get());
        forwarded.set(null);

        MockServerWebExchange me = exchange(HttpMethod.GET, "/api/auth/me", null);
        filter.filter(me, chain).block();
        assertEquals(HttpStatus.UNAUTHORIZED, me.getResponse().getStatusCode());
        assertNull(forwarded.get());
    }

    @Test
    void shortSecretFailsFastAtStartup() {
        assertThrows(IllegalStateException.class, () -> new JwtAuthenticationFilter("too-short", ISSUER));
    }

    private MockServerWebExchange exchange(HttpMethod method, String path, String authorization) {
        MockServerHttpRequest.BaseBuilder<?> builder = MockServerHttpRequest.method(method, path);
        if (authorization != null) {
            builder.header("Authorization", authorization);
        }
        return MockServerWebExchange.from(builder.build());
    }

    private String token(String secret, String issuer, String role, Instant expiry) {
        return Jwts.builder().issuer(issuer).subject("2").claim("username", "asha").claim("role", role)
                .issuedAt(Date.from(Instant.now().minusSeconds(120))).expiration(Date.from(expiry))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
    }
}

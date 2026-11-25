package com.resqnet.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;

/**
 * THE security control of the whole system (rubric: "authentication checked at the gateway").
 *
 * A GlobalFilter runs for every request that the gateway routes. This one, with highest priority:
 *  1. removes any X-User-* headers sent by the client (they could be forged),
 *  2. lets the public routes (register, login) through,
 *  3. otherwise requires "Authorization: Bearer <jwt>", verifies signature, issuer and expiry,
 *  4. on success adds trusted X-User-Id / X-User-Name / X-User-Role headers for the services,
 *  5. on failure answers 401 right here; the request never reaches a service.
 */
@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    static final String HEADER_ID = "X-User-Id";
    static final String HEADER_NAME = "X-User-Name";
    static final String HEADER_ROLE = "X-User-Role";
    private static final Set<String> ROLES = Set.of("USER", "ADMIN");

    private final SecretKey key;
    private final String issuer;

    public JwtAuthenticationFilter(@Value("${jwt.secret}") String secret,
                                   @Value("${jwt.issuer}") String issuer) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {   // fail fast: a short secret would be insecure
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.issuer = issuer;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();

        // Step 1: always drop client-supplied identity headers, even on public routes.
        ServerHttpRequest cleaned = request.mutate().headers(h -> {
            h.remove(HEADER_ID);
            h.remove(HEADER_NAME);
            h.remove(HEADER_ROLE);
        }).build();

        // Step 2: public routes need no token.
        if (isPublic(request)) {
            return chain.filter(exchange.mutate().request(cleaned).build());
        }

        // Step 3: a Bearer token is required.
        String authorization = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return unauthorized(exchange, "no bearer token");
        }

        Claims claims;
        try {
            // Verifies the HS256 signature, the issuer and the expiry time in one call.
            claims = Jwts.parser().verifyWith(key).requireIssuer(issuer).build()
                    .parseSignedClaims(authorization.substring(7).trim()).getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return unauthorized(exchange, "token rejected: " + e.getClass().getSimpleName());
        }

        String userId = claims.getSubject();
        String username = claims.get("username", String.class);
        String role = claims.get("role", String.class);
        if (userId == null || username == null || role == null || !ROLES.contains(role)) {
            return unauthorized(exchange, "required claims missing");
        }

        // Step 4: forward the verified identity to the downstream service.
        ServerHttpRequest authenticated = cleaned.mutate()
                .header(HEADER_ID, userId)
                .header(HEADER_NAME, username)
                .header(HEADER_ROLE, role)
                .build();
        return chain.filter(exchange.mutate().request(authenticated).build());
    }

    /** Only registration and login are public (health is served by the gateway itself, not routed). */
    private boolean isPublic(ServerHttpRequest request) {
        String path = request.getPath().value();
        return HttpMethod.POST.equals(request.getMethod())
                && ("/api/auth/register".equals(path) || "/api/auth/login".equals(path));
    }

    /** Writes the 401 JSON body directly. The real reason is only logged, never sent to the client. */
    private Mono<Void> unauthorized(ServerWebExchange exchange, String reason) {
        String path = exchange.getRequest().getPath().value();
        log.warn("401 for {} {}: {}", exchange.getRequest().getMethod(), path, reason);

        String body = "{\"timestamp\":\"" + Instant.now().truncatedTo(ChronoUnit.SECONDS) + "\","
                + "\"status\":401,\"error\":\"Unauthorized\",\"code\":\"UNAUTHORIZED\","
                + "\"message\":\"Missing or invalid token\",\"path\":\"" + path.replace("\"", "") + "\"}";
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }
}

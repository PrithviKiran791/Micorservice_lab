package com.resqnet.gateway.ops;

import com.fasterxml.jackson.databind.JsonNode;
import com.resqnet.gateway.security.JwtVerifier;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.function.Supplier;

/**
 * Operations API for the administrator dashboard: GET /api/ops/health | resilience | traffic | kubernetes.
 *
 * These endpoints are answered by the gateway itself (they are not routed to any service), so the routing filter does
 * not see them. Each method therefore checks the JWT here, with the same verifier and rules: no token or a bad token
 * gives 401, a valid token without the ADMIN role gives 403. Read-only; nothing here changes any state.
 */
@RestController
@RequestMapping("/api/ops")
public class OpsController {

    private static final Logger log = LoggerFactory.getLogger(OpsController.class);

    private final JwtVerifier verifier;
    private final OpsService ops;

    public OpsController(JwtVerifier verifier, OpsService ops) {
        this.verifier = verifier;
        this.ops = ops;
    }

    @GetMapping("/health")
    public Mono<ResponseEntity<JsonNode>> health(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return guarded(auth, "/api/ops/health", ops::health);
    }

    @GetMapping("/resilience")
    public Mono<ResponseEntity<JsonNode>> resilience(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return guarded(auth, "/api/ops/resilience", ops::resilience);
    }

    @GetMapping("/traffic")
    public Mono<ResponseEntity<JsonNode>> traffic(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return guarded(auth, "/api/ops/traffic", ops::traffic);
    }

    @GetMapping("/kubernetes")
    public Mono<ResponseEntity<JsonNode>> kubernetes(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return guarded(auth, "/api/ops/kubernetes", ops::kubernetes);
    }

    private Mono<ResponseEntity<JsonNode>> guarded(String authorization, String path, Supplier<Mono<? extends JsonNode>> body) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return Mono.just(rejection(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing or invalid token", path, "no bearer token"));
        }
        Claims claims;
        try {
            claims = verifier.verify(authorization.substring(7).trim());
        } catch (JwtException | IllegalArgumentException e) {
            return Mono.just(rejection(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing or invalid token", path, "token rejected: " + e.getClass().getSimpleName()));
        }
        if (!"ADMIN".equals(claims.get("role", String.class))) {
            return Mono.just(rejection(HttpStatus.FORBIDDEN, "FORBIDDEN", "Administrator role required", path, "role is not ADMIN"));
        }
        return body.get().map(json -> ResponseEntity.ok().cacheControl(CacheControl.noStore()).<JsonNode>body(json));
    }

    private ResponseEntity<JsonNode> rejection(HttpStatus status, String code, String message, String path, String reason) {
        log.warn("{} for GET {}: {}", status.value(), path, reason);
        var node = new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
        node.put("timestamp", Instant.now().truncatedTo(ChronoUnit.SECONDS).toString());
        node.put("status", status.value());
        node.put("error", status.getReasonPhrase());
        node.put("code", code);
        node.put("message", message);
        node.put("path", path);
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(node);
    }
}

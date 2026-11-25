package com.resqnet.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * Checks a JWT (HS256 signature, issuer, expiry) with the same secret and issuer as the gateway filter.
 * The routed API is protected by {@link JwtAuthenticationFilter}; this class protects the endpoints the gateway
 * answers itself (the operations API), which never pass through the routing filters.
 */
@Component
public class JwtVerifier {

    private final SecretKey key;
    private final String issuer;

    public JwtVerifier(@Value("${jwt.secret}") String secret, @Value("${jwt.issuer}") String issuer) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.issuer = issuer;
    }

    /** @throws JwtException if the token is malformed, expired, wrongly signed or has the wrong issuer */
    public Claims verify(String token) {
        return Jwts.parser().verifyWith(key).requireIssuer(issuer).build().parseSignedClaims(token).getPayload();
    }
}

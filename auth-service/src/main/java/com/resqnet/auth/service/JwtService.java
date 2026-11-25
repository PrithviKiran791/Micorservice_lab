package com.resqnet.auth.service;

import com.resqnet.auth.model.User;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

import io.jsonwebtoken.security.Keys;

/**
 * Creates signed JWTs (HS256). The API Gateway verifies them with the same secret.
 * Token content: iss, sub (user id), username, role, iat, exp.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final String issuer;
    private final long expiryMinutes;

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${jwt.issuer}") String issuer,
                      @Value("${jwt.expiry-minutes}") long expiryMinutes) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {   // HS256 needs a 256-bit key: fail fast at start-up
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.issuer = issuer;
        this.expiryMinutes = expiryMinutes;
    }

    public String issueToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(issuer)
                .subject(String.valueOf(user.getId()))
                .claim("username", user.getUsername())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(Duration.ofMinutes(expiryMinutes))))
                .signWith(key)
                .compact();
    }

    public long expiresInSeconds() {
        return Duration.ofMinutes(expiryMinutes).toSeconds();
    }
}

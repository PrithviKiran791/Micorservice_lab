package com.resqnet.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Only the BCrypt hashing library is used (spring-security-crypto), not full Spring Security,
 * so no endpoint gets locked by default. Authentication is the gateway's job.
 */
@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);   // strength 10, as in docs/AUTHENTICATION.md
    }
}

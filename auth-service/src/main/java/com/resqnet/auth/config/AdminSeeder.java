package com.resqnet.auth.config;

import com.resqnet.auth.model.Role;
import com.resqnet.auth.model.User;
import com.resqnet.auth.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the demo ADMIN account on start-up, but only if it does not exist yet,
 * so restarts never duplicate it (rule R-DB-5). Credentials: admin / Admin@123 (DEMO ONLY).
 * An ApplicationRunner runs once, right after the application has started.
 */
@Component
public class AdminSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminSeeder.class);
    private static final String ADMIN_USERNAME = "admin";
    private static final String ADMIN_DEMO_PASSWORD = "Admin@123";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.existsByUsername(ADMIN_USERNAME)) {
            return;
        }
        userRepository.save(new User(ADMIN_USERNAME, passwordEncoder.encode(ADMIN_DEMO_PASSWORD), Role.ADMIN));
        log.info("Seeded demo admin account '{}'", ADMIN_USERNAME);
    }
}

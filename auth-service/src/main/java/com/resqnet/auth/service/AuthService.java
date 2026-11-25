package com.resqnet.auth.service;

import com.resqnet.auth.dto.CurrentUserResponse;
import com.resqnet.auth.dto.LoginRequest;
import com.resqnet.auth.dto.LoginResponse;
import com.resqnet.auth.dto.RegisterRequest;
import com.resqnet.auth.dto.UserResponse;
import com.resqnet.auth.exception.ApiException;
import com.resqnet.auth.model.Role;
import com.resqnet.auth.model.User;
import com.resqnet.auth.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Business logic of auth-service: register a user and log in. */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    /**
     * Creates a new account. @Transactional = the save either fully happens or not at all.
     * The role is always USER; nobody can self-register as ADMIN.
     */
    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw usernameTaken();
        }
        User user = new User(request.username(), passwordEncoder.encode(request.password()), Role.USER);
        try {
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Two simultaneous registrations passed the check above; the unique constraint caught the second.
            throw usernameTaken();
        }
        log.info("Registered user id={}", user.getId());
        return UserResponse.from(user);
    }

    /**
     * Checks the password and issues a JWT. Unknown user and wrong password give the
     * identical error so an attacker cannot discover which usernames exist.
     */
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .filter(User::isEnabled)
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS",
                        "Invalid username or password"));
        log.info("Login ok for user id={}", user.getId());
        return new LoginResponse(jwtService.issueToken(user), "Bearer", jwtService.expiresInSeconds(),
                new CurrentUserResponse(user.getId(), user.getUsername(), user.getRole().name()));
    }

    private ApiException usernameTaken() {
        return new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "Username is already taken");
    }
}

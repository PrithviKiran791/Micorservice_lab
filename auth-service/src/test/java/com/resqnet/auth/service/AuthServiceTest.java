package com.resqnet.auth.service;

import com.resqnet.auth.dto.LoginRequest;
import com.resqnet.auth.dto.LoginResponse;
import com.resqnet.auth.dto.RegisterRequest;
import com.resqnet.auth.dto.UserResponse;
import com.resqnet.auth.exception.ApiException;
import com.resqnet.auth.model.Role;
import com.resqnet.auth.model.User;
import com.resqnet.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit tests for AuthService: the repository is mocked, BCrypt and JWT are real. */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);   // low strength = fast tests
    private AuthService authService;

    @BeforeEach
    void setUp() {
        JwtService jwtService = new JwtService("test-secret-test-secret-test-secret-123", "resqnet-auth", 120);
        authService = new AuthService(userRepository, encoder, jwtService);
    }

    @Test
    void duplicateUsernameReturns409UsernameTaken() {
        when(userRepository.existsByUsername("asha")).thenReturn(true);

        ApiException ex = assertThrows(ApiException.class,
                () -> authService.register(new RegisterRequest("asha", "Pass@1234")));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("USERNAME_TAKEN", ex.getCode());
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void registrationAlwaysCreatesUserRoleWithHashedPassword() {
        when(userRepository.existsByUsername("asha")).thenReturn(false);
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserResponse response = authService.register(new RegisterRequest("asha", "Pass@1234"));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertEquals("USER", response.role());
        assertEquals(Role.USER, saved.getValue().getRole());
        assertNotEquals("Pass@1234", saved.getValue().getPasswordHash());   // only the hash is stored
        assertTrue(encoder.matches("Pass@1234", saved.getValue().getPasswordHash()));
    }

    @Test
    void wrongPasswordReturns401InvalidCredentials() {
        User user = new User("asha", encoder.encode("Pass@1234"), Role.USER);
        when(userRepository.findByUsername("asha")).thenReturn(Optional.of(user));

        ApiException ex = assertThrows(ApiException.class,
                () -> authService.login(new LoginRequest("asha", "wrong-password")));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertEquals("INVALID_CREDENTIALS", ex.getCode());
    }

    @Test
    void unknownUserGivesSameErrorAsWrongPassword() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        ApiException ex = assertThrows(ApiException.class,
                () -> authService.login(new LoginRequest("ghost", "Pass@1234")));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
        assertEquals("INVALID_CREDENTIALS", ex.getCode());
        assertEquals("Invalid username or password", ex.getMessage());
    }

    @Test
    void correctPasswordReturnsBearerToken() {
        User user = new User("asha", encoder.encode("Pass@1234"), Role.USER);
        when(userRepository.findByUsername("asha")).thenReturn(Optional.of(user));

        LoginResponse response = authService.login(new LoginRequest("asha", "Pass@1234"));

        assertEquals("Bearer", response.tokenType());
        assertEquals(7200, response.expiresInSeconds());
        assertEquals(3, response.token().split("\\.").length);   // header.payload.signature
    }
}

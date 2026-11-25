package com.resqnet.auth.controller;

import com.resqnet.auth.dto.CurrentUserResponse;
import com.resqnet.auth.dto.LoginRequest;
import com.resqnet.auth.dto.LoginResponse;
import com.resqnet.auth.dto.RegisterRequest;
import com.resqnet.auth.dto.UserResponse;
import com.resqnet.auth.exception.ApiException;
import com.resqnet.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP layer only (thin controller). The gateway strips "/api", so the public
 * /api/auth/** paths arrive here as /auth/**.
 * @RestController = every method returns JSON; @Valid triggers Bean Validation on the body.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /**
     * Who am I? The identity comes ONLY from the X-User-* headers that the gateway sets
     * after verifying the JWT. No database call is needed.
     */
    @GetMapping("/me")
    public CurrentUserResponse me(@RequestHeader(value = "X-User-Id", required = false) String id,
                                  @RequestHeader(value = "X-User-Name", required = false) String username,
                                  @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (id == null || username == null || role == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing or invalid token");
        }
        try {
            return new CurrentUserResponse(Long.valueOf(id), username, role);
        } catch (NumberFormatException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing or invalid token");
        }
    }
}

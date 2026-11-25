package com.resqnet.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of POST /auth/login. */
public record LoginRequest(
        @NotBlank String username,
        @NotBlank String password) {
}

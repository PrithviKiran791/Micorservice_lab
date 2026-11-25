package com.resqnet.auth.dto;

/** Short user view used inside the login response and by GET /auth/me. */
public record CurrentUserResponse(Long id, String username, String role) {
}

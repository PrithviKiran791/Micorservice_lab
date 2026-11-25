package com.resqnet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Body of POST /auth/register. There is deliberately no "role" field:
 * public registration always creates a USER (unknown JSON fields are ignored).
 */
public record RegisterRequest(
        @NotBlank
        @Size(min = 3, max = 50)
        @Pattern(regexp = "[A-Za-z0-9_.-]*", message = "may contain only letters, digits, '_', '.', '-'")
        String username,

        @NotBlank
        @Size(min = 8, max = 72)   // 72 = BCrypt's maximum input length
        String password) {
}

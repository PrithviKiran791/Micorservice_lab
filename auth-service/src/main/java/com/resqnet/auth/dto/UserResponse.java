package com.resqnet.auth.dto;

import com.resqnet.auth.model.User;

import java.time.Instant;

/** 201 response of register. Never contains the password hash. */
public record UserResponse(Long id, String username, String role, Instant createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getRole().name(), user.getCreatedAt());
    }
}

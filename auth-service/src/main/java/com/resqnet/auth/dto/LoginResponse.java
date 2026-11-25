package com.resqnet.auth.dto;

/** 200 response of login: the JWT plus basic user info. */
public record LoginResponse(String token, String tokenType, long expiresInSeconds, CurrentUserResponse user) {
}

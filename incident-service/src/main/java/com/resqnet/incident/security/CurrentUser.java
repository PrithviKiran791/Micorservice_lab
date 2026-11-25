package com.resqnet.incident.security;

import com.resqnet.incident.exception.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;

/**
 * Who is calling? Read ONLY from the X-User-* headers that the gateway set after verifying the JWT
 * (rules R-SE-1 and R-SE-4). This service never parses a JWT and never trusts the request body for identity.
 * It is safe because the service is ClusterIP: the only way in is through the gateway, which
 * strips any client-supplied X-User-* headers first.
 */
public record CurrentUser(Long id, String username, String role) {

    public static CurrentUser from(HttpServletRequest request) {
        String id = request.getHeader("X-User-Id");
        String username = request.getHeader("X-User-Name");
        String role = request.getHeader("X-User-Role");
        if (id == null || username == null || role == null || !(role.equals("USER") || role.equals("ADMIN"))) {
            throw unauthorized();
        }
        try {
            return new CurrentUser(Long.valueOf(id), username, role);
        } catch (NumberFormatException e) {
            throw unauthorized();
        }
    }

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }

    /** Admin-only operations (dispatch, resolve): a USER gets 403 FORBIDDEN. */
    public void requireAdmin() {
        if (!isAdmin()) {
            throw forbidden();
        }
    }

    /** Reading one incident: the reporter or an admin. */
    public void requireOwnerOrAdmin(Long ownerId) {
        if (!isAdmin() && !id.equals(ownerId)) {
            throw forbidden();
        }
    }

    private static ApiException unauthorized() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing or invalid identity");
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You are not allowed to do this");
    }
}

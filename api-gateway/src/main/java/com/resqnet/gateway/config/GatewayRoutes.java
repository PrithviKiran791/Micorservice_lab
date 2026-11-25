package com.resqnet.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The routing table, written in Java (property names for routes changed between Spring Cloud versions).
 * Each public /api/<x>/** path goes to the owning service with the "/api" prefix removed
 * (StripPrefix=1), e.g. /api/incidents/5 -> incident-service /incidents/5.
 *
 * X-Gateway-Prefix tells the service which prefix was removed, so its error bodies can show the
 * path the client really called. setRequestHeader overwrites any value the client tried to send.
 *
 * There is intentionally NO route for /internal/**: assign/release are service-to-service only,
 * so a client asking for them gets 404 from the gateway.
 */
@Configuration
public class GatewayRoutes {

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder,
                               @Value("${resqnet.services.auth-url}") String authUrl,
                               @Value("${resqnet.services.incident-url}") String incidentUrl,
                               @Value("${resqnet.services.responder-url}") String responderUrl,
                               @Value("${resqnet.services.notification-url}") String notificationUrl) {
        return builder.routes()
                .route("auth", r -> r.path("/api/auth/**").filters(f -> f.stripPrefix(1).setRequestHeader("X-Gateway-Prefix", "/api")).uri(authUrl))
                .route("incidents", r -> r.path("/api/incidents/**").filters(f -> f.stripPrefix(1).setRequestHeader("X-Gateway-Prefix", "/api")).uri(incidentUrl))
                .route("responders", r -> r.path("/api/responders/**").filters(f -> f.stripPrefix(1).setRequestHeader("X-Gateway-Prefix", "/api")).uri(responderUrl))
                .route("notifications", r -> r.path("/api/notifications/**").filters(f -> f.stripPrefix(1).setRequestHeader("X-Gateway-Prefix", "/api")).uri(notificationUrl))
                .build();
    }
}

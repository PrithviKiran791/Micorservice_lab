package com.resqnet.gateway.config;

import org.springframework.cloud.gateway.route.builder.GatewayFilterSpec;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.TimeoutException;

/**
 * The routing table, written in Java (property names for routes changed between Spring Cloud versions).
 * Each public /api/<x>/** path goes to the owning service with the "/api" prefix removed
 * (StripPrefix=1), e.g. /api/incidents/5 -> incident-service /incidents/5.
 *
 * "lb://incident-service" means: ask the Eureka registry which copies of "incident-service" are running
 * and let Spring Cloud LoadBalancer pick one for every request (round-robin). That is how adding a second
 * copy of a service automatically shares the traffic, and how a dead copy stops receiving requests.
 *
 * RETRY (smooth failover): when a copy has just died or is shutting down, the registry and the load
 * balancer need a few seconds to notice, and a request can be sent to the dead copy (connection refused,
 * connection reset or timeout). For GET requests the gateway then simply tries again, up to 2 more times;
 * every retry asks the load balancer again, so it usually lands on a healthy copy and the caller never
 * sees the failure. Only GET is retried because it is idempotent (repeating it changes nothing); a POST
 * such as "report incident" is never repeated automatically, so no incident can be created twice.
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
    public RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
                .route("auth", r -> r.path("/api/auth/**")
                        .filters(this::standardFilters).uri("lb://auth-service"))
                .route("incidents", r -> r.path("/api/incidents/**")
                        .filters(this::standardFilters).uri("lb://incident-service"))
                .route("responders", r -> r.path("/api/responders/**")
                        .filters(this::standardFilters).uri("lb://responder-service"))
                .route("notifications", r -> r.path("/api/notifications/**")
                        .filters(this::standardFilters).uri("lb://notification-service"))
                .build();
    }

    /** Filters shared by every route: strip "/api", tell the service about it, retry failed GETs. */
    private GatewayFilterSpec standardFilters(GatewayFilterSpec f) {
        return f.stripPrefix(1)
                .setRequestHeader("X-Gateway-Prefix", "/api")
                .retry(retry -> retry
                        .setRetries(2)                                        // 1 original try + up to 2 retries
                        .setMethods(HttpMethod.GET)                           // idempotent requests only
                        .setSeries()                                          // do not retry on arbitrary 5xx answers ...
                        .setStatuses(HttpStatus.BAD_GATEWAY, HttpStatus.SERVICE_UNAVAILABLE, HttpStatus.GATEWAY_TIMEOUT) // ... only on these
                        .setExceptions(IOException.class, TimeoutException.class)  // refused / reset / timed out
                        .setBackoff(Duration.ofMillis(50), Duration.ofMillis(500), 2, false)); // wait 50 ms, then 100 ms
    }
}

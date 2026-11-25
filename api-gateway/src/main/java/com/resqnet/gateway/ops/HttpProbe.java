package com.resqnet.gateway.ops;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Small GET-JSON helper for the operations API. It never fails: an unreachable target is an ordinary result
 * ("reachable = false"), because "the service is down" is exactly the information the dashboard wants to show.
 * Only addresses that come from the Eureka registry or from configuration are ever requested, never from the client.
 */
@Component
public class HttpProbe {

    /** @param reachable false when no HTTP answer arrived (refused, timeout, DNS); {@code status} is then 0 */
    public record Result(boolean reachable, int status, JsonNode body, long millis, String error) {
        public boolean ok() {
            return reachable && status >= 200 && status < 300;
        }
    }

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final ObjectMapper mapper;

    public HttpProbe(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public Mono<Result> get(String url, Duration timeout) {
        long start = System.nanoTime();
        HttpRequest request;
        try {
            request = HttpRequest.newBuilder(URI.create(url)).timeout(timeout).header("Accept", "application/json").GET().build();
        } catch (IllegalArgumentException e) {
            return Mono.just(new Result(false, 0, null, 0, "invalid address"));
        }
        return Mono.fromFuture(() -> client.sendAsync(request, HttpResponse.BodyHandlers.ofString()))
                .map(response -> new Result(true, response.statusCode(), parse(response.body()), millisSince(start), null))
                .onErrorResume(e -> Mono.just(new Result(false, 0, null, millisSince(start), e.getClass().getSimpleName())));
    }

    private JsonNode parse(String body) {
        try {
            return body == null || body.isBlank() ? null : mapper.readTree(body);
        } catch (Exception e) {
            return null;     // not JSON (for example an HTML error page)
        }
    }

    private static long millisSince(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}

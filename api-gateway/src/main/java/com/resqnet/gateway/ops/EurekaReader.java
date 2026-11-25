package com.resqnet.gateway.ops;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Reads the instance list of the Eureka registry (GET /eureka/apps), the same registry the gateway routes with. */
@Component
public class EurekaReader {

    /** One registered instance. {@code app} is lower-case, for example "incident-service". */
    public record Instance(String app, String instanceId, String host, int port, String status) {
        public String baseUrl() {
            return "http://" + host + ":" + port;
        }

        public String address() {
            return host + ":" + port;
        }
    }

    private final HttpProbe probe;
    private final String registryUrl;

    public EurekaReader(HttpProbe probe,
                        @Value("${eureka.client.service-url.defaultZone:http://localhost:8761/eureka}") String defaultZone) {
        this.probe = probe;
        String first = defaultZone.split(",")[0].trim();
        this.registryUrl = first.endsWith("/") ? first.substring(0, first.length() - 1) : first;
    }

    /** Base address of the registry process itself (used to check the discovery-service's own health). */
    public String registryBaseUrl() {
        URI uri = URI.create(registryUrl);
        return uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
    }

    /** Emits the instance list, or an error when the registry cannot be read (the caller reports "registry unreachable"). */
    public Mono<List<Instance>> instances() {
        return probe.get(registryUrl + "/apps", Duration.ofSeconds(2)).flatMap(result -> {
            if (!result.ok() || result.body() == null) {
                return Mono.error(new IllegalStateException(result.reachable() ? "registry answered HTTP " + result.status() : "registry unreachable"));
            }
            return Mono.just(parse(result.body()));
        });
    }

    static List<Instance> parse(JsonNode root) {
        List<Instance> out = new ArrayList<>();
        for (JsonNode app : each(root.path("applications").path("application"))) {
            for (JsonNode i : each(app.path("instance"))) {
                String ip = i.path("ipAddr").asText("");
                int port = i.path("port").path("$").asInt(0);
                if (ip.isBlank() || port <= 0) {
                    continue;
                }
                out.add(new Instance(i.path("app").asText(app.path("name").asText("")).toLowerCase(),
                        i.path("instanceId").asText(ip + ":" + port), ip, port, i.path("status").asText("UNKNOWN")));
            }
        }
        return out;
    }

    /** Eureka writes a single element as an object and several as an array. */
    private static Iterable<JsonNode> each(JsonNode node) {
        if (node.isArray()) {
            return node;
        }
        return node.isMissingNode() || node.isNull() ? List.of() : List.of(node);
    }
}

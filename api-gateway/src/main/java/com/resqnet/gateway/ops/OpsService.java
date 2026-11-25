package com.resqnet.gateway.ops;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resqnet.gateway.ops.EurekaReader.Instance;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Builds the answers of the operations API from live information only:
 * the Eureka registry, the /actuator endpoints of every registered instance (reachable inside the cluster only)
 * and the read-only Kubernetes API. Nothing is cached or invented: when a source cannot be read, the answer says so
 * ("UNKNOWN", "unavailable") instead of guessing.
 */
@Service
public class OpsService {

    /** Services that register with Eureka, in display order. discovery-service is the registry itself and is probed directly. */
    static final List<String> SERVICES = List.of("api-gateway", "auth-service", "incident-service", "responder-service", "notification-service");

    /** Database design: one database per business service (see docs/schema.md). */
    static final Map<String, String> DATABASES = Map.of(
            "auth-service", "auth_db", "incident-service", "incident_db",
            "responder-service", "responder_db", "notification-service", "notification_db");

    /** The services that publish or consume RabbitMQ events and therefore report a "rabbit" health component. */
    static final List<String> BROKER_CLIENTS = List.of("incident-service", "notification-service");

    /** Request counters worth showing per service: the controller URI templates as Micrometer tags them. */
    static final Map<String, List<String>> TRAFFIC_URIS = Map.of(
            "auth-service", List.of("/auth/login", "/auth/register", "/auth/me"),
            "incident-service", List.of("/incidents", "/incidents/{id}"),
            "responder-service", List.of("/responders", "/internal/responders/assign"),
            "notification-service", List.of("/notifications"));

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(2);

    private final EurekaReader eureka;
    private final HttpProbe probe;
    private final KubernetesReader kubernetes;
    private final ObjectMapper mapper;
    private final Map<String, Instant> lastHealthy = new ConcurrentHashMap<>();

    public OpsService(EurekaReader eureka, HttpProbe probe, KubernetesReader kubernetes, ObjectMapper mapper) {
        this.eureka = eureka;
        this.probe = probe;
        this.kubernetes = kubernetes;
        this.mapper = mapper;
    }

    // ------------------------------------------------------------------------------------------------ health

    /** Service health, discovery, databases and RabbitMQ in one answer (one probe of every instance). */
    public Mono<ObjectNode> health() {
        Mono<Optional<List<Instance>>> registry = eureka.instances().map(Optional::of).onErrorReturn(Optional.empty());
        Mono<HttpProbe.Result> discoveryProbe = probe.get(eureka.registryBaseUrl() + "/actuator/health", PROBE_TIMEOUT);

        return Mono.zip(registry, discoveryProbe).flatMap(t -> {
            Optional<List<Instance>> instances = t.getT1();
            HttpProbe.Result discoveryResult = t.getT2();
            List<Instance> all = instances.orElse(List.of());
            List<Instance> tracked = all.stream().filter(i -> SERVICES.contains(i.app())).toList();

            return Flux.fromIterable(tracked)
                    .flatMap(i -> probe.get(i.baseUrl() + "/actuator/health", PROBE_TIMEOUT).map(r -> new Probed(i, r)))
                    .collectList()
                    .map(probed -> assembleHealth(instances.isPresent(), all, probed, discoveryResult));
        });
    }

    private record Probed(Instance instance, HttpProbe.Result result) {
        String health() {
            return result.reachable() && result.body() != null && result.body().has("status") ? result.body().get("status").asText() : "UNREACHABLE";
        }

        String component(String name) {
            JsonNode c = result.body() == null ? null : result.body().path("components").path(name);
            return c == null || c.isMissingNode() ? null : c.path("status").asText(null);
        }
    }

    private ObjectNode assembleHealth(boolean registryReadable, List<Instance> all, List<Probed> probed, HttpProbe.Result discoveryResult) {
        ObjectNode out = mapper.createObjectNode();
        out.put("generatedAt", Instant.now().toString());
        out.put("source", "live: Eureka registry + /actuator/health of every instance");

        // --- discovery
        ObjectNode discovery = out.putObject("discovery");
        discovery.put("health", discoveryResult.reachable() && discoveryResult.body() != null ? discoveryResult.body().path("status").asText("UNKNOWN") : "UNREACHABLE");
        discovery.put("registryReadable", registryReadable);
        discovery.put("responseMs", discoveryResult.millis());
        ArrayNode apps = discovery.putArray("registeredApplications");
        Map<String, List<Instance>> byApp = all.stream().collect(Collectors.groupingBy(Instance::app, LinkedHashMap::new, Collectors.toList()));
        byApp.forEach((app, list) -> {
            ObjectNode a = apps.addObject();
            a.put("name", app);
            a.put("instances", list.size());
            a.put("up", list.stream().filter(i -> "UP".equals(i.status())).count());
        });

        // --- services
        ArrayNode services = out.putArray("services");
        for (String name : SERVICES) {
            // sorted, so the list does not reshuffle between refreshes (probes finish in random order)
            List<Probed> mine = probed.stream().filter(p -> p.instance().app().equals(name))
                    .sorted(java.util.Comparator.comparing((Probed p) -> p.instance().instanceId())).toList();
            ObjectNode s = services.addObject();
            s.put("name", name);
            s.put("registeredInstances", mine.size());
            ArrayNode list = s.putArray("instances");
            long up = 0;
            for (Probed p : mine) {
                ObjectNode i = list.addObject();
                i.put("instanceId", p.instance().instanceId());
                i.put("address", p.instance().address());
                i.put("eurekaStatus", p.instance().status());
                i.put("health", p.health());
                i.put("responseMs", p.result().millis());
                ObjectNode components = i.putObject("components");
                if (p.result().body() != null) {
                    p.result().body().path("components").fields().forEachRemaining(e -> components.put(e.getKey(), e.getValue().path("status").asText()));
                }
                if ("UP".equals(p.health())) {
                    up++;
                }
            }
            String status;
            String reason = null;
            if (!registryReadable) {
                status = "UNKNOWN";
                reason = "The Eureka registry could not be read, so the instances of this service are not known.";
            } else if (mine.isEmpty()) {
                status = "DOWN";
                reason = "No instance is registered in Eureka.";
            } else if (up == mine.size()) {
                status = "UP";
            } else if (up > 0) {
                status = "DEGRADED";
            } else {
                status = "DOWN";
            }
            s.put("status", status);
            if (reason != null) {
                s.put("reason", reason);
            }
            s.put("healthyInstances", up);
            if ("UP".equals(status) || "DEGRADED".equals(status)) {
                lastHealthy.put(name, Instant.now());
            }
            Instant last = lastHealthy.get(name);
            s.put("lastHealthyAt", last == null ? null : last.toString());
        }

        // --- databases: the "db" component of each service's health (names and UP/DOWN only)
        ArrayNode databases = out.putArray("databases");
        for (String service : List.of("auth-service", "incident-service", "responder-service", "notification-service")) {
            ObjectNode d = databases.addObject();
            d.put("service", service);
            d.put("database", DATABASES.get(service));
            d.put("status", aggregate(probed, service, "db"));
        }

        // --- RabbitMQ: the "rabbit" component of the two services that use the broker
        ObjectNode rabbit = out.putObject("rabbitmq");
        ArrayNode clients = rabbit.putArray("reportedBy");
        List<String> statuses = new ArrayList<>();
        for (String service : BROKER_CLIENTS) {
            String st = aggregate(probed, service, "rabbit");
            statuses.add(st);
            ObjectNode c = clients.addObject();
            c.put("service", service);
            c.put("role", "incident-service".equals(service) ? "publishes incident events" : "consumes incident events");
            c.put("status", st);
        }
        rabbit.put("status", statuses.contains("DOWN") ? "DOWN" : statuses.stream().allMatch("UP"::equals) ? "UP" : "UNKNOWN");
        return out;
    }

    /** UP if any instance reports the component UP, DOWN if instances report it but none is UP, UNKNOWN if nobody reports it. */
    private static String aggregate(List<Probed> probed, String service, String component) {
        List<String> reported = probed.stream().filter(p -> p.instance().app().equals(service)).map(p -> p.component(component)).filter(s -> s != null).toList();
        if (reported.isEmpty()) {
            return "UNKNOWN";
        }
        return reported.contains("UP") ? "UP" : "DOWN";
    }

    // ------------------------------------------------------------------------------------------------ resilience

    /** Circuit-breaker state and recent events, asked from every incident-service instance (each pod has its own breaker). */
    public Mono<ObjectNode> resilience() {
        return eureka.instances().map(Optional::of).onErrorReturn(Optional.empty()).flatMap(opt -> {
            List<Instance> incident = opt.orElse(List.of()).stream().filter(i -> i.app().equals("incident-service")).toList();
            return Flux.fromIterable(incident).flatMap(i ->
                    Mono.zip(probe.get(i.baseUrl() + "/actuator/circuitbreakers", PROBE_TIMEOUT),
                             probe.get(i.baseUrl() + "/actuator/circuitbreakerevents", PROBE_TIMEOUT))
                        .map(z -> instanceResilience(i, z.getT1(), z.getT2())))
                    .collectList().map(list -> {
                        ObjectNode out = mapper.createObjectNode();
                        out.put("generatedAt", Instant.now().toString());
                        out.put("registryReadable", opt.isPresent());
                        out.put("source", "live: /actuator/circuitbreakers and /actuator/circuitbreakerevents of every incident-service instance");
                        ArrayNode instances = out.putArray("instances");
                        list.forEach(instances::add);
                        return out;
                    });
        });
    }

    private ObjectNode instanceResilience(Instance instance, HttpProbe.Result breakers, HttpProbe.Result events) {
        ObjectNode o = mapper.createObjectNode();
        o.put("instanceId", instance.instanceId());
        o.put("address", instance.address());
        o.put("available", breakers.ok() && breakers.body() != null);
        if (!breakers.ok() || breakers.body() == null) {
            o.put("reason", breakers.reachable() ? "HTTP " + breakers.status() + " from /actuator/circuitbreakers" : "instance unreachable");
            return o;
        }
        o.set("circuitBreakers", breakers.body().path("circuitBreakers"));
        ArrayNode recent = o.putArray("events");
        if (events.ok() && events.body() != null) {
            JsonNode all = events.body().path("circuitBreakerEvents");
            int from = Math.max(0, all.size() - 15);
            for (int i = all.size() - 1; i >= from; i--) {           // newest first
                JsonNode e = all.get(i);
                ObjectNode r = recent.addObject();
                r.put("name", e.path("circuitBreakerName").asText());
                r.put("type", e.path("type").asText());
                r.put("time", e.path("creationTime").asText());
                if (e.has("stateTransition")) {
                    r.put("stateTransition", e.path("stateTransition").asText());
                }
                if (e.has("errorMessage")) {
                    String m = e.path("errorMessage").asText();
                    r.put("errorMessage", m.length() > 160 ? m.substring(0, 160) : m);
                }
            }
        }
        return o;
    }

    // ------------------------------------------------------------------------------------------------ traffic

    /** Request counters per pod from Micrometer (counted since each pod started). */
    public Mono<ObjectNode> traffic() {
        return eureka.instances().map(Optional::of).onErrorReturn(Optional.empty()).flatMap(opt -> {
            List<Instance> targets = opt.orElse(List.of()).stream().filter(i -> TRAFFIC_URIS.containsKey(i.app())).toList();
            return Flux.fromIterable(targets).flatMap(this::instanceTraffic).collectList().map(list -> {
                ObjectNode out = mapper.createObjectNode();
                out.put("generatedAt", Instant.now().toString());
                out.put("registryReadable", opt.isPresent());
                out.put("source", "live: Micrometer http.server.requests of every instance; counted since that pod started");
                ArrayNode instances = out.putArray("instances");
                list.stream().sorted((a, b) -> a.path("service").asText().concat(a.path("instanceId").asText())
                        .compareTo(b.path("service").asText().concat(b.path("instanceId").asText()))).forEach(instances::add);
                return out;
            });
        });
    }

    private Mono<ObjectNode> instanceTraffic(Instance instance) {
        // First ask without a filter: 200 means the metrics endpoint is there; a 404 on a filtered query then only means "no such request yet" (= 0).
        return probe.get(instance.baseUrl() + "/actuator/metrics/http.server.requests", PROBE_TIMEOUT).flatMap(base -> {
            ObjectNode o = mapper.createObjectNode();
            o.put("service", instance.app());
            o.put("instanceId", instance.instanceId());
            o.put("address", instance.address());
            if (!base.ok()) {
                o.put("available", false);
                o.put("reason", base.reachable() ? "metrics endpoint answered HTTP " + base.status() : "instance unreachable");
                return Mono.just(o);
            }
            o.put("available", true);
            return Flux.fromIterable(TRAFFIC_URIS.get(instance.app())).concatMap(uri ->
                    probe.get(instance.baseUrl() + "/actuator/metrics/http.server.requests?tag=uri:" + encode(uri), PROBE_TIMEOUT)
                         .map(r -> Map.entry(uri, r.ok() ? count(r.body()) : 0L)))
                    .collectList().map(entries -> {
                        ObjectNode counts = o.putObject("requests");
                        entries.forEach(e -> counts.put(e.getKey(), e.getValue()));
                        return o;
                    });
        });
    }

    private static long count(JsonNode body) {
        if (body != null) {
            for (JsonNode m : body.path("measurements")) {
                if ("COUNT".equals(m.path("statistic").asText())) {
                    return Math.round(m.path("value").asDouble(0));
                }
            }
        }
        return 0L;
    }

    private static String encode(String uri) {
        return uri.replace("{", "%7B").replace("}", "%7D");
    }

    // ------------------------------------------------------------------------------------------------ kubernetes

    public Mono<ObjectNode> kubernetes() {
        return kubernetes.read().map(node -> {
            node.put("generatedAt", Instant.now().toString());
            node.put("source", "live: Kubernetes API (read-only ServiceAccount of the gateway)");
            return node;
        });
    }
}

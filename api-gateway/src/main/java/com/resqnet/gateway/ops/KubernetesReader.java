package com.resqnet.gateway.ops;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.io.FileInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.time.Duration;
import java.util.Collection;

/**
 * Read-only view of the Kubernetes namespace, for the dashboard. The browser must not talk to the cluster, so the
 * gateway does it with its own ServiceAccount token (k8s/31-gateway-rbac.yaml grants only get/list on deployments,
 * pods and services in the namespace "resqnet"). Only a few harmless fields are copied into the answer: no
 * environment variables, no secrets, no pod specs.
 *
 * Outside a cluster (local run, unit tests) there is no token, and the answer is simply {"available": false, "reason": ...}.
 */
@Component
public class KubernetesReader {

    private final ObjectMapper mapper;
    private final Path tokenFile;
    private final Path caFile;
    private final String namespace;
    private final String apiUrlOverride;

    public KubernetesReader(ObjectMapper mapper,
                            @Value("${ops.kubernetes.token-file:/var/run/secrets/kubernetes.io/serviceaccount/token}") String tokenFile,
                            @Value("${ops.kubernetes.ca-file:/var/run/secrets/kubernetes.io/serviceaccount/ca.crt}") String caFile,
                            @Value("${ops.kubernetes.namespace:resqnet}") String namespace,
                            @Value("${ops.kubernetes.api-url:}") String apiUrlOverride) {
        this.mapper = mapper;
        this.tokenFile = Path.of(tokenFile);
        this.caFile = Path.of(caFile);
        this.namespace = namespace;
        this.apiUrlOverride = apiUrlOverride;
    }

    public Mono<ObjectNode> read() {
        return Mono.fromCallable(this::readBlocking).subscribeOn(Schedulers.boundedElastic());
    }

    private ObjectNode readBlocking() {
        ObjectNode out = mapper.createObjectNode();
        out.put("namespace", namespace);
        String api = apiUrl();
        if (api == null || !Files.isReadable(tokenFile)) {
            return unavailable(out, "The gateway is not running inside a Kubernetes cluster (no service-account token).");
        }
        try {
            String token = Files.readString(tokenFile, StandardCharsets.UTF_8).trim();
            HttpClient client = client(api);
            String base = api + "/apis/apps/v1/namespaces/" + namespace;
            JsonNode deployments = get(client, base + "/deployments", token);
            JsonNode pods = get(client, api + "/api/v1/namespaces/" + namespace + "/pods", token);
            JsonNode services = get(client, api + "/api/v1/namespaces/" + namespace + "/services", token);

            out.put("available", true);
            out.set("deployments", reduceDeployments(deployments));
            out.set("pods", reducePods(pods));
            out.set("services", reduceServices(services));
            return out;
        } catch (Exception e) {
            return unavailable(out, "Kubernetes API request failed: " + e.getClass().getSimpleName()
                    + (e.getMessage() != null ? " (" + shorten(e.getMessage()) + ")" : ""));
        }
    }

    private String apiUrl() {
        if (!apiUrlOverride.isBlank()) {
            return apiUrlOverride;
        }
        String host = System.getenv("KUBERNETES_SERVICE_HOST");
        String port = System.getenv("KUBERNETES_SERVICE_PORT");
        return host == null || host.isBlank() ? null : "https://" + host + ":" + (port == null ? "443" : port);
    }

    private HttpClient client(String api) throws Exception {
        HttpClient.Builder builder = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2));
        if (api.startsWith("https") && Files.isReadable(caFile)) {
            KeyStore trust = KeyStore.getInstance(KeyStore.getDefaultType());
            trust.load(null, null);
            try (FileInputStream in = new FileInputStream(caFile.toFile())) {
                Collection<? extends Certificate> certs = CertificateFactory.getInstance("X.509").generateCertificates(in);
                int n = 0;
                for (Certificate c : certs) {
                    trust.setCertificateEntry("kubernetes-ca-" + n++, c);
                }
            }
            TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            tmf.init(trust);
            SSLContext ssl = SSLContext.getInstance("TLS");
            ssl.init(null, tmf.getTrustManagers(), null);
            builder.sslContext(ssl);
        }
        return builder.build();
    }

    private JsonNode get(HttpClient client, String url, String token) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(4))
                .header("Authorization", "Bearer " + token).header("Accept", "application/json").GET().build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("HTTP " + response.statusCode() + " for " + url.substring(url.lastIndexOf('/')));
        }
        return mapper.readTree(response.body());
    }

    private ObjectNode unavailable(ObjectNode out, String reason) {
        out.put("available", false);
        out.put("reason", reason);
        return out;
    }

    static ArrayNode reduceDeployments(JsonNode list) {
        ArrayNode out = new ObjectMapper().createArrayNode();
        for (JsonNode d : list.path("items")) {
            ObjectNode o = out.addObject();
            o.put("name", d.path("metadata").path("name").asText());
            o.put("desired", d.path("spec").path("replicas").asInt(0));
            o.put("ready", d.path("status").path("readyReplicas").asInt(0));
            o.put("available", d.path("status").path("availableReplicas").asInt(0));
            o.put("updated", d.path("status").path("updatedReplicas").asInt(0));
            JsonNode containers = d.path("spec").path("template").path("spec").path("containers");
            o.put("image", containers.path(0).path("image").asText(""));
        }
        return out;
    }

    static ArrayNode reducePods(JsonNode list) {
        ArrayNode out = new ObjectMapper().createArrayNode();
        for (JsonNode p : list.path("items")) {
            ObjectNode o = out.addObject();
            o.put("name", p.path("metadata").path("name").asText());
            o.put("app", p.path("metadata").path("labels").path("app").asText(""));
            o.put("phase", p.path("status").path("phase").asText("Unknown"));
            JsonNode statuses = p.path("status").path("containerStatuses");
            boolean allReady = statuses.size() > 0;
            int restarts = 0;
            for (JsonNode c : statuses) {
                allReady &= c.path("ready").asBoolean(false);
                restarts += c.path("restartCount").asInt(0);
            }
            o.put("ready", allReady);
            o.put("restarts", restarts);
            o.put("startedAt", p.path("status").path("startTime").asText(""));
            o.put("terminating", !p.path("metadata").path("deletionTimestamp").isMissingNode());
        }
        return out;
    }

    static ArrayNode reduceServices(JsonNode list) {
        ArrayNode out = new ObjectMapper().createArrayNode();
        for (JsonNode s : list.path("items")) {
            ObjectNode o = out.addObject();
            o.put("name", s.path("metadata").path("name").asText());
            o.put("type", s.path("spec").path("type").asText("ClusterIP"));
            ArrayNode ports = o.putArray("ports");
            for (JsonNode p : s.path("spec").path("ports")) {
                ObjectNode port = ports.addObject();
                port.put("port", p.path("port").asInt());
                if (p.has("nodePort")) {
                    port.put("nodePort", p.path("nodePort").asInt());
                }
            }
        }
        return out;
    }

    private static String shorten(String s) {
        return s.length() > 120 ? s.substring(0, 120) : s;
    }
}

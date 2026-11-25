package com.resqnet.incident.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Builds the HTTP client used to call responder-service.
 *
 * @LoadBalanced makes the client resolve the host name "responder-service" through the Eureka registry
 * and choose one of the running copies (service discovery + client-side load balancing); there is no
 * fixed address anywhere.
 *
 * The two timeouts are what make a dead or frozen responder-service fail FAST:
 * connection refused is immediate, and a hung service is cut off after the read timeout (2 s).
 */
@Configuration
public class RestClientConfig {

    @Bean
    @LoadBalanced
    public RestClient.Builder loadBalancedRestClientBuilder() {
        return RestClient.builder();
    }

    @Bean
    public RestClient responderRestClient(@LoadBalanced RestClient.Builder builder,
                                          @Value("${responder.service.url}") String baseUrl,
                                          @Value("${responder.service.connect-timeout-ms}") int connectTimeoutMs,
                                          @Value("${responder.service.read-timeout-ms}") int readTimeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        return builder.baseUrl(baseUrl).requestFactory(factory).build();
    }
}

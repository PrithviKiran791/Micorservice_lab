package com.resqnet.incident.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Builds the HTTP client used to call responder-service.
 * The two timeouts are what make a dead or frozen responder-service fail FAST:
 * connection refused is immediate, and a hung service is cut off after the read timeout (2 s).
 */
@Configuration
public class RestClientConfig {

    @Bean
    public RestClient responderRestClient(@Value("${responder.service.url}") String baseUrl,
                                          @Value("${responder.service.connect-timeout-ms}") int connectTimeoutMs,
                                          @Value("${responder.service.read-timeout-ms}") int readTimeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
}

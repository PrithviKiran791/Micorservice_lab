package com.resqnet.discovery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/**
 * Service registry (Netflix Eureka server): the "phone book" of the system.
 * Every service registers its name and address here when it starts and sends a heartbeat every 5 seconds;
 * the gateway and incident-service look services up by NAME (for example "responder-service") instead of
 * by a fixed address, and Spring Cloud LoadBalancer spreads calls over all registered copies.
 * @EnableEurekaServer turns this ordinary Spring Boot app into the registry. It has no database.
 */
@SpringBootApplication
@EnableEurekaServer
public class DiscoveryServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(DiscoveryServiceApplication.class, args);
    }
}
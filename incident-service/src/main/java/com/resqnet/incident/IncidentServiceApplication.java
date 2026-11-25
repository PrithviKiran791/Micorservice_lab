package com.resqnet.incident;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Entry point of incident-service. @SpringBootApplication turns on auto-configuration and component scanning. */
@SpringBootApplication
public class IncidentServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(IncidentServiceApplication.class, args);
    }
}

package com.resqnet.incident;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Entry point of incident-service. @SpringBootApplication turns on auto-configuration and component scanning. */
@SpringBootApplication
public class IncidentServiceApplication {
    public static void main(String[] args) {
        // All times are UTC (rule R-CD-8). This also avoids PostgreSQL rejecting legacy zone
        // names such as "Asia/Calcutta" that some Windows JVMs report.
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"));
        SpringApplication.run(IncidentServiceApplication.class, args);
    }
}

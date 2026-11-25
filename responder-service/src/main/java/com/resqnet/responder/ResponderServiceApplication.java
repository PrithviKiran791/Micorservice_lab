package com.resqnet.responder;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Entry point of responder-service. @SpringBootApplication turns on auto-configuration and component scanning. */
@SpringBootApplication
public class ResponderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResponderServiceApplication.class, args);
    }
}

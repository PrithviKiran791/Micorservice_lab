package com.resqnet.incident.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;

/**
 * Adds a response header "X-Served-By: <pod name>" so the load-balancing demo can show WHICH copy of
 * the service answered each request. In Kubernetes the host name of a container is its pod name.
 * A OncePerRequestFilter runs exactly once for every incoming HTTP request.
 */
@Component
public class ServedByFilter extends OncePerRequestFilter {

    private final String instanceName = resolveInstanceName();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader("X-Served-By", instanceName);
        chain.doFilter(request, response);
    }

    private static String resolveInstanceName() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }
}
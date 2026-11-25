package com.resqnet.incident.dto;

import com.resqnet.incident.model.IncidentType;
import com.resqnet.incident.model.Severity;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Body of POST /incidents. The reporter's identity is NOT in the body: it comes from the gateway headers. */
public record CreateIncidentRequest(
        @NotNull IncidentType type,
        @NotNull Severity severity,
        @NotBlank @Size(max = 500) String description,
        @NotBlank @Size(max = 200) String locationText,
        @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
        @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude) {
}

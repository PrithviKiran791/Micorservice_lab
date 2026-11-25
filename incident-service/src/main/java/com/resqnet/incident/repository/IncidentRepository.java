package com.resqnet.incident.repository;

import com.resqnet.incident.model.Incident;
import com.resqnet.incident.model.IncidentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Spring Data builds these queries from the method names. All lists are newest first. */
public interface IncidentRepository extends JpaRepository<Incident, Long> {

    List<Incident> findAllByOrderByCreatedAtDesc();

    List<Incident> findByStatusOrderByCreatedAtDesc(IncidentStatus status);

    List<Incident> findByReportedByUserIdOrderByCreatedAtDesc(Long userId);

    List<Incident> findByReportedByUserIdAndStatusOrderByCreatedAtDesc(Long userId, IncidentStatus status);
}

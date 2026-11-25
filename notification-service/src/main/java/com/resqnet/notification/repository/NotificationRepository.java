package com.resqnet.notification.repository;

import com.resqnet.notification.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Spring Data builds these queries from the method names. Lists are newest first. */
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    boolean existsByEventId(UUID eventId);

    List<Notification> findAllByOrderByCreatedAtDesc();

    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
}

package com.resqnet.notification.controller;

import com.resqnet.notification.dto.NotificationResponse;
import com.resqnet.notification.security.CurrentUser;
import com.resqnet.notification.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** HTTP layer only. The gateway strips "/api", so /api/notifications/** arrives here as /notifications/**. */
@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public List<NotificationResponse> list(HttpServletRequest http,
                                           @RequestParam(defaultValue = "false") boolean mine) {
        return service.list(CurrentUser.from(http), mine);
    }

    @PatchMapping("/{id}/read")
    public NotificationResponse markRead(HttpServletRequest http, @PathVariable Long id) {
        return service.markRead(CurrentUser.from(http), id);
    }
}

package com.poly.mhv.controller;

import com.poly.mhv.dto.notification.NotificationDetailResponse;
import com.poly.mhv.dto.notification.NotificationFeedResponse;
import com.poly.mhv.service.NotificationService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<NotificationFeedResponse> getFeed() {
        return ResponseEntity.ok(notificationService.getFeed());
    }

    @GetMapping("/{id}")
    public ResponseEntity<NotificationDetailResponse> getDetail(@PathVariable Integer id) {
        return ResponseEntity.ok(notificationService.getDetailAndMarkAsRead(id));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Map<String, String>> markAsRead(@PathVariable Integer id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok(Map.of("message", "Đã đánh dấu đã xem."));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Map<String, String>> markAllAsRead() {
        notificationService.markAllAsRead();
        return ResponseEntity.ok(Map.of("message", "Đã đánh dấu tất cả đã xem."));
    }
}

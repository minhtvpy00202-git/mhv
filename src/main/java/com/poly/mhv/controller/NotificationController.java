package com.poly.mhv.controller;

import com.poly.mhv.dto.notification.NotificationDetailResponse;
import com.poly.mhv.dto.notification.NotificationFeedResponse;
import com.poly.mhv.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/notifications", "/notifications"})
@Tag(name = "Thông báo", description = "API lấy feed thông báo và đánh dấu đã đọc")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @Operation(summary = "Lấy feed thông báo", description = "Lấy danh sách thông báo gần đây và tổng số chưa đọc của người dùng hiện tại.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy feed thông báo thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<NotificationFeedResponse> getFeed() {
        return ResponseEntity.ok(notificationService.getFeed());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết thông báo", description = "Lấy chi tiết một thông báo và đồng thời đánh dấu đã đọc.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy chi tiết thông báo thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy thông báo")
    })
    public ResponseEntity<NotificationDetailResponse> getDetail(@PathVariable Integer id) {
        return ResponseEntity.ok(notificationService.getDetailAndMarkAsRead(id));
    }

    @PostMapping("/{id}/read")
    @Operation(summary = "Đánh dấu đã đọc", description = "Đánh dấu một thông báo là đã đọc.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Đánh dấu đã đọc thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy thông báo")
    })
    public ResponseEntity<Map<String, String>> markAsRead(@PathVariable Integer id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok(Map.of("message", "Đã đánh dấu đã xem."));
    }

    @PostMapping("/read-all")
    @Operation(summary = "Đánh dấu đã đọc tất cả", description = "Đánh dấu toàn bộ thông báo của người dùng hiện tại là đã đọc.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Đánh dấu tất cả đã đọc thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<Map<String, String>> markAllAsRead() {
        notificationService.markAllAsRead();
        return ResponseEntity.ok(Map.of("message", "Đã đánh dấu tất cả đã xem."));
    }
}

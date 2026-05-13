package com.poly.mhv.controller;

import com.poly.mhv.service.AdminAlertSseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping({"/api/alerts", "/alerts"})
@Tag(name = "Cảnh báo realtime", description = "API stream sự kiện realtime cho giao diện quản trị qua Server-Sent Events")
@SecurityRequirement(name = "bearerAuth")
public class AdminAlertController {

    private final AdminAlertSseService adminAlertSseService;

    public AdminAlertController(AdminAlertSseService adminAlertSseService) {
        this.adminAlertSseService = adminAlertSseService;
    }

    @GetMapping("/stream")
    @Operation(summary = "Mở luồng cảnh báo SSE", description = "Tạo kết nối Server-Sent Events để nhận cảnh báo realtime cho quản trị.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Mở stream SSE thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public SseEmitter stream() {
        return adminAlertSseService.subscribe();
    }
}

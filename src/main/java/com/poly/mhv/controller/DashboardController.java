package com.poly.mhv.controller;

import com.poly.mhv.dto.dashboard.DashboardSummaryResponse;
import com.poly.mhv.dto.dashboard.SmartSuggestionResponse;
import com.poly.mhv.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/dashboard", "/dashboard"})
@Tag(name = "Dashboard", description = "API tổng hợp số liệu và gợi ý nhanh cho màn hình tổng quan")
@SecurityRequirement(name = "bearerAuth")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    @Operation(summary = "Lấy số liệu tổng quan", description = "Trả về số liệu dashboard chính cho màn hình quản trị.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy số liệu tổng quan thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<DashboardSummaryResponse> getSummary() {
        return ResponseEntity.ok(dashboardService.getSummary());
    }

    @GetMapping("/smart-suggestions")
    @Operation(summary = "Lấy gợi ý thông minh", description = "Trả về các gợi ý và cảnh báo nhanh từ dữ liệu hiện tại.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy gợi ý thông minh thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<SmartSuggestionResponse> getSmartSuggestions() {
        return ResponseEntity.ok(dashboardService.getSmartSuggestions());
    }
}

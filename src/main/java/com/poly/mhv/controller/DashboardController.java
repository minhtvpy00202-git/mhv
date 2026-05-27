package com.poly.mhv.controller;

import com.poly.mhv.dto.dashboard.AdminDashboardBootstrapResponse;
import com.poly.mhv.dto.dashboard.DashboardSummaryResponse;
import com.poly.mhv.dto.dashboard.HelpdeskKpiResponse;
import com.poly.mhv.dto.dashboard.SmartSuggestionResponse;
import com.poly.mhv.service.DashboardService;
import com.poly.mhv.service.HelpdeskKpiService;
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
    private final HelpdeskKpiService helpdeskKpiService;

    public DashboardController(DashboardService dashboardService, HelpdeskKpiService helpdeskKpiService) {
        this.dashboardService = dashboardService;
        this.helpdeskKpiService = helpdeskKpiService;
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

    @GetMapping("/bootstrap")
    @Operation(summary = "Tải dữ liệu dashboard admin", description = "Trả về số liệu tổng quan, gợi ý thông minh và KPI helpdesk trong một request.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy dữ liệu dashboard admin thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền xem dashboard admin")
    })
    public ResponseEntity<AdminDashboardBootstrapResponse> getAdminBootstrap() {
        HelpdeskKpiResponse helpdeskKpis = helpdeskKpiService.getAdminKpis();
        return ResponseEntity.ok(dashboardService.getAdminBootstrap(helpdeskKpis));
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

    @GetMapping("/helpdesk-kpis/admin")
    @Operation(summary = "Lấy KPI helpdesk cho admin", description = "Trả về 6 KPI helpdesk cốt lõi trên phạm vi toàn hệ thống.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy KPI helpdesk admin thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền xem KPI admin")
    })
    public ResponseEntity<HelpdeskKpiResponse> getAdminHelpdeskKpis() {
        return ResponseEntity.ok(helpdeskKpiService.getAdminKpis());
    }

    @GetMapping("/helpdesk-kpis/me")
    @Operation(summary = "Lấy KPI helpdesk cá nhân", description = "Trả về KPI helpdesk theo phạm vi kỹ thuật viên đang đăng nhập.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy KPI helpdesk cá nhân thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền xem KPI cá nhân")
    })
    public ResponseEntity<HelpdeskKpiResponse> getMyHelpdeskKpis() {
        return ResponseEntity.ok(helpdeskKpiService.getCurrentTechnicianKpis());
    }
}

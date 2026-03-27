package com.poly.mhv.controller;

import com.poly.mhv.dto.dashboard.DashboardSummaryResponse;
import com.poly.mhv.dto.dashboard.SmartSuggestionResponse;
import com.poly.mhv.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    public ResponseEntity<DashboardSummaryResponse> getSummary() {
        return ResponseEntity.ok(dashboardService.getSummary());
    }

    @GetMapping("/smart-suggestions")
    public ResponseEntity<SmartSuggestionResponse> getSmartSuggestions() {
        return ResponseEntity.ok(dashboardService.getSmartSuggestions());
    }
}

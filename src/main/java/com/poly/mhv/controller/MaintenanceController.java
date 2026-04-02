package com.poly.mhv.controller;

import com.poly.mhv.dto.maintenance.MaintenanceHistoryResponse;
import com.poly.mhv.dto.maintenance.MaintenanceReportRequest;
import com.poly.mhv.dto.maintenance.MaintenanceReportResponse;
import com.poly.mhv.service.MaintenanceService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/maintenance")
public class MaintenanceController {

    private final MaintenanceService maintenanceService;

    public MaintenanceController(MaintenanceService maintenanceService) {
        this.maintenanceService = maintenanceService;
    }

    @PostMapping("/report")
    public ResponseEntity<MaintenanceReportResponse> report(@RequestBody MaintenanceReportRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(maintenanceService.report(request));
    }

    @GetMapping("/history/me")
    public ResponseEntity<List<MaintenanceHistoryResponse>> getMyHistory() {
        return ResponseEntity.ok(maintenanceService.getMyHistory());
    }

    @GetMapping("/history")
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<List<MaintenanceHistoryResponse>> getHistoryForAdmin() {
        return ResponseEntity.ok(maintenanceService.getAllForAdminHistory());
    }
}

package com.poly.mhv.controller;

import com.poly.mhv.dto.maintenance.MaintenanceReportRequest;
import com.poly.mhv.dto.maintenance.MaintenanceReportResponse;
import com.poly.mhv.service.MaintenanceService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
}

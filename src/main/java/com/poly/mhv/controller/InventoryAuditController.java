package com.poly.mhv.controller;

import com.poly.mhv.dto.inventory.InventoryAuditCreateRequest;
import com.poly.mhv.dto.inventory.InventoryAuditDetailResponse;
import com.poly.mhv.dto.inventory.InventoryAuditScanRequest;
import com.poly.mhv.dto.inventory.InventoryAuditScanResultResponse;
import com.poly.mhv.dto.inventory.InventoryAuditSummaryResponse;
import com.poly.mhv.service.InventoryAuditService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inventory-audits")
public class InventoryAuditController {

    private final InventoryAuditService inventoryAuditService;

    public InventoryAuditController(InventoryAuditService inventoryAuditService) {
        this.inventoryAuditService = inventoryAuditService;
    }

    @PostMapping
    public ResponseEntity<InventoryAuditSummaryResponse> createAudit(@RequestBody InventoryAuditCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryAuditService.createAudit(request));
    }

    @GetMapping
    public ResponseEntity<List<InventoryAuditSummaryResponse>> getAudits(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(inventoryAuditService.getAudits(status));
    }

    @GetMapping("/active")
    public ResponseEntity<List<InventoryAuditSummaryResponse>> getActiveAudits() {
        return ResponseEntity.ok(inventoryAuditService.getActiveAudits());
    }

    @GetMapping("/history/me")
    public ResponseEntity<List<InventoryAuditSummaryResponse>> getMyAudits() {
        return ResponseEntity.ok(inventoryAuditService.getMyAudits());
    }

    @GetMapping("/{auditId}")
    public ResponseEntity<InventoryAuditDetailResponse> getDetail(@PathVariable Integer auditId) {
        return ResponseEntity.ok(inventoryAuditService.getDetail(auditId));
    }

    @PostMapping("/{auditId}/scan")
    public ResponseEntity<InventoryAuditScanResultResponse> scanAsset(
            @PathVariable Integer auditId,
            @RequestBody InventoryAuditScanRequest request
    ) {
        return ResponseEntity.ok(inventoryAuditService.scanAsset(auditId, request));
    }

    @PostMapping("/{auditId}/complete")
    public ResponseEntity<InventoryAuditDetailResponse> completeAudit(@PathVariable Integer auditId) {
        return ResponseEntity.ok(inventoryAuditService.completeAudit(auditId));
    }

    @PostMapping("/{auditId}/missing/{assetQaCode}/found")
    public ResponseEntity<InventoryAuditDetailResponse> resolveFound(
            @PathVariable Integer auditId,
            @PathVariable String assetQaCode
    ) {
        return ResponseEntity.ok(inventoryAuditService.resolveMissingFound(auditId, assetQaCode));
    }

    @PostMapping("/{auditId}/missing/{assetQaCode}/lost")
    public ResponseEntity<InventoryAuditDetailResponse> resolveLost(
            @PathVariable Integer auditId,
            @PathVariable String assetQaCode
    ) {
        return ResponseEntity.ok(inventoryAuditService.resolveMissingLost(auditId, assetQaCode));
    }
}

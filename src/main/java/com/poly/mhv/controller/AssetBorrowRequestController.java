package com.poly.mhv.controller;

import com.poly.mhv.dto.inquiry.AssetBorrowRequestResponse;
import com.poly.mhv.dto.inquiry.BorrowRequestDecisionRequest;
import com.poly.mhv.service.AssetBorrowRequestService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/borrow-requests")
@RequiredArgsConstructor
public class AssetBorrowRequestController {

    private final AssetBorrowRequestService service;

    @GetMapping("/me")
    @PreAuthorize("hasRole('NhanVien')")
    public ResponseEntity<List<AssetBorrowRequestResponse>> getMine() {
        return ResponseEntity.ok(service.getMine());
    }

    @GetMapping("/inbox")
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<List<AssetBorrowRequestResponse>> getInbox(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(service.getInbox(status));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('NhanVien','Admin')")
    public ResponseEntity<AssetBorrowRequestResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<AssetBorrowRequestResponse> approve(
            @PathVariable Long id,
            @RequestBody(required = false) BorrowRequestDecisionRequest request) {
        return ResponseEntity.ok(service.approve(id, request));
    }

    @PostMapping("/{id}/reserve")
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<AssetBorrowRequestResponse> reserve(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) BorrowRequestDecisionRequest request) {
        return ResponseEntity.ok(service.reserve(id, request));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<AssetBorrowRequestResponse> reject(
            @PathVariable Long id,
            @Valid @RequestBody BorrowRequestDecisionRequest request) {
        return ResponseEntity.ok(service.reject(id, request));
    }

    @PostMapping("/{id}/handover")
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<AssetBorrowRequestResponse> handover(@PathVariable Long id) {
        return ResponseEntity.ok(service.handover(id));
    }

    @PostMapping("/{id}/return")
    @PreAuthorize("hasAnyRole('NhanVien','Admin')")
    public ResponseEntity<AssetBorrowRequestResponse> confirmReturn(@PathVariable Long id) {
        return ResponseEntity.ok(service.confirmReturn(id));
    }
}

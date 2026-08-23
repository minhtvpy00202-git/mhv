package com.poly.mhv.controller;

import com.poly.mhv.dto.inquiry.ConsumableFulfillmentQuantityRequest;
import com.poly.mhv.dto.inquiry.ConsumableFulfillmentWarehouseRequest;
import com.poly.mhv.dto.inquiry.ConsumableInquiryFulfillmentResponse;
import com.poly.mhv.dto.inquiry.InquiryActionRequest;
import com.poly.mhv.service.ConsumableInquiryFulfillmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/consumable-fulfillments")
@RequiredArgsConstructor
public class ConsumableInquiryFulfillmentController {

    private final ConsumableInquiryFulfillmentService service;

    @GetMapping("/inquiry/{inquiryId}")
    @PreAuthorize("hasAnyRole('NhanVien','Admin','ConsumableManager')")
    public ResponseEntity<ConsumableInquiryFulfillmentResponse> getByInquiry(@PathVariable Long inquiryId) {
        return ResponseEntity.ok(service.getByInquiryId(inquiryId));
    }

    @PostMapping("/{id}/admin-approve")
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<ConsumableInquiryFulfillmentResponse> adminApprove(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) InquiryActionRequest request) {
        return ResponseEntity.ok(service.adminApprove(id, request));
    }

    @PostMapping("/{id}/warehouse")
    @PreAuthorize("hasRole('ConsumableManager')")
    public ResponseEntity<ConsumableInquiryFulfillmentResponse> transferWarehouse(
            @PathVariable Long id,
            @Valid @RequestBody ConsumableFulfillmentWarehouseRequest request) {
        return ResponseEntity.ok(service.transferWarehouse(id, request));
    }

    @PostMapping("/{id}/prepare")
    @PreAuthorize("hasRole('ConsumableManager')")
    public ResponseEntity<ConsumableInquiryFulfillmentResponse> prepare(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) ConsumableFulfillmentQuantityRequest request) {
        return ResponseEntity.ok(service.prepare(id, request));
    }

    @PostMapping("/{id}/ready")
    @PreAuthorize("hasRole('ConsumableManager')")
    public ResponseEntity<ConsumableInquiryFulfillmentResponse> ready(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) InquiryActionRequest request) {
        return ResponseEntity.ok(service.markReady(id, request));
    }

    @PostMapping("/{id}/fulfill")
    @PreAuthorize("hasRole('ConsumableManager')")
    public ResponseEntity<ConsumableInquiryFulfillmentResponse> fulfill(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) InquiryActionRequest request) {
        return ResponseEntity.ok(service.fulfill(id, request));
    }

    @PostMapping("/{id}/close-partial")
    @PreAuthorize("hasRole('ConsumableManager')")
    public ResponseEntity<ConsumableInquiryFulfillmentResponse> closePartial(
            @PathVariable Long id,
            @Valid @RequestBody InquiryActionRequest request) {
        return ResponseEntity.ok(service.closePartial(id, request));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
    public ResponseEntity<ConsumableInquiryFulfillmentResponse> reject(
            @PathVariable Long id,
            @Valid @RequestBody InquiryActionRequest request) {
        return ResponseEntity.ok(service.reject(id, request));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('NhanVien')")
    public ResponseEntity<ConsumableInquiryFulfillmentResponse> cancel(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) InquiryActionRequest request) {
        return ResponseEntity.ok(service.cancel(id, request));
    }
}

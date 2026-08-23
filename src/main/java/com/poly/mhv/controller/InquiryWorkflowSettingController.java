package com.poly.mhv.controller;

import com.poly.mhv.dto.inquiry.InquiryWorkflowSettingRequest;
import com.poly.mhv.dto.inquiry.InquiryWorkflowSettingResponse;
import com.poly.mhv.service.InquiryWorkflowSettingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inquiry-workflow-settings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('Admin')")
public class InquiryWorkflowSettingController {

    private final InquiryWorkflowSettingService service;

    @GetMapping
    public ResponseEntity<InquiryWorkflowSettingResponse> get() {
        return ResponseEntity.ok(service.getForAdmin());
    }

    @PutMapping
    public ResponseEntity<InquiryWorkflowSettingResponse> update(
            @Valid @RequestBody InquiryWorkflowSettingRequest request) {
        return ResponseEntity.ok(service.update(request));
    }
}

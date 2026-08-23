package com.poly.mhv.controller;

import com.poly.mhv.dto.inquiry.InquiryReportResponse;
import com.poly.mhv.service.InquiryReportService;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inquiry-reports")
@RequiredArgsConstructor
public class InquiryReportController {

    private final InquiryReportService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
    public ResponseEntity<InquiryReportResponse> getReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String targetRole) {
        return ResponseEntity.ok(service.getReport(fromDate, toDate, targetRole));
    }
}

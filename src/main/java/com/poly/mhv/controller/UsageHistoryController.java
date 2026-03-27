package com.poly.mhv.controller;

import com.poly.mhv.dto.usage.CheckinRequest;
import com.poly.mhv.dto.usage.CheckoutRequest;
import com.poly.mhv.dto.usage.UsageHistoryAdminResponse;
import com.poly.mhv.dto.usage.UsageHistoryResponse;
import com.poly.mhv.service.UsageHistoryService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/usage")
public class UsageHistoryController {

    private final UsageHistoryService usageHistoryService;

    public UsageHistoryController(UsageHistoryService usageHistoryService) {
        this.usageHistoryService = usageHistoryService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<UsageHistoryResponse> checkout(@RequestBody CheckoutRequest request) {
        return ResponseEntity.ok(usageHistoryService.checkout(request));
    }

    @PostMapping("/checkin")
    public ResponseEntity<UsageHistoryResponse> checkin(@RequestBody CheckinRequest request) {
        return ResponseEntity.ok(usageHistoryService.checkin(request));
    }

    @GetMapping("/history")
    public ResponseEntity<List<UsageHistoryAdminResponse>> getHistoryForAdmin(
            @RequestParam(required = false) String assetName,
            @RequestParam(required = false) Integer borrowedLocationId,
            @RequestParam(required = false) Integer userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return ResponseEntity.ok(usageHistoryService.searchForAdmin(assetName, borrowedLocationId, userId, startDate, endDate));
    }
}

package com.poly.mhv.controller;

import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.ReportService;
import java.io.IOException;
import java.time.LocalDate;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/export-assets")
    public ResponseEntity<byte[]> exportAssets() {
        try {
            byte[] excelBytes = reportService.exportAssetsExcel();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDisposition(ContentDisposition.attachment().filename("danh-sach-thiet-bi.xlsx").build());
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(excelBytes);
        } catch (IOException ex) {
            throw new CustomException("Không thể xuất báo cáo Excel.");
        }
    }

    @GetMapping("/export-usage-history")
    public ResponseEntity<byte[]> exportUsageHistory(
            @RequestParam(required = false) String assetName,
            @RequestParam(required = false) Integer borrowedLocationId,
            @RequestParam(required = false) Integer userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        try {
            byte[] excelBytes = reportService.exportUsageHistoryExcel(assetName, borrowedLocationId, userId, startDate, endDate);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDisposition(ContentDisposition.attachment().filename("lich-su-muon-thiet-bi.xlsx").build());
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(excelBytes);
        } catch (IOException ex) {
            throw new CustomException("Không thể xuất báo cáo Excel lịch sử mượn.");
        }
    }

    @GetMapping("/export-inventory-audit/{auditId}")
    public ResponseEntity<byte[]> exportInventoryAudit(@PathVariable Integer auditId) {
        try {
            byte[] excelBytes = reportService.exportInventoryAuditExcel(auditId);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDisposition(ContentDisposition.attachment().filename("bien-ban-kiem-ke-" + auditId + ".xlsx").build());
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(excelBytes);
        } catch (IOException ex) {
            throw new CustomException("Không thể xuất biên bản kiểm kê.");
        }
    }
}

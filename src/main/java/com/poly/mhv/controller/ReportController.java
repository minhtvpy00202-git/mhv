package com.poly.mhv.controller;

import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.time.LocalDate;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/reports", "/reports"})
@Tag(name = "Báo cáo", description = "API xuất báo cáo Excel cho thiết bị, lịch sử mượn trả và kiểm kê")
@SecurityRequirement(name = "bearerAuth")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/export-assets")
    @Operation(summary = "Xuất Excel danh sách thiết bị", description = "Xuất file Excel chứa danh sách toàn bộ thiết bị.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xuất báo cáo thiết bị thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "500", description = "Lỗi xuất file Excel")
    })
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
    @Operation(summary = "Xuất Excel lịch sử mượn trả", description = "Xuất file Excel lịch sử mượn trả với các bộ lọc tương ứng.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xuất báo cáo lịch sử mượn trả thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "500", description = "Lỗi xuất file Excel")
    })
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
    @Operation(summary = "Xuất Excel biên bản kiểm kê", description = "Xuất file Excel biên bản kiểm kê theo id phiên kiểm kê.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xuất biên bản kiểm kê thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy phiên kiểm kê"),
            @ApiResponse(responseCode = "500", description = "Lỗi xuất file Excel")
    })
    @PreAuthorize("hasRole('Admin')")
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

    @GetMapping("/export-expired-disposal/{requestId}")
    @Operation(summary = "Xuất biên bản tiêu huỷ hàng hết hạn", description = "Xuất file Word biên bản tiêu huỷ cho một yêu cầu tiêu huỷ vật tư hết hạn đã được duyệt.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xuất biên bản tiêu huỷ thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy yêu cầu tiêu huỷ"),
            @ApiResponse(responseCode = "500", description = "Lỗi xuất file Word")
    })
    @PreAuthorize("hasAnyRole('Admin','ConsumableManager')")
    public ResponseEntity<byte[]> exportExpiredDisposal(@PathVariable Long requestId) {
        try {
            byte[] documentBytes = reportService.exportExpiredDisposalDocument(requestId);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
            headers.setContentDisposition(ContentDisposition.attachment().filename("bien-ban-huy-hang-hoa-het-han-" + requestId + ".docx").build());
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(documentBytes);
        } catch (IOException ex) {
            throw new CustomException("Không thể xuất biên bản tiêu huỷ.");
        }
    }
}

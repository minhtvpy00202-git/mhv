package com.poly.mhv.controller;

import com.poly.mhv.dto.statistics.AssetStatisticsResponse;
import com.poly.mhv.exception.CustomException;
import com.poly.mhv.service.AssetStatisticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/assets/statistics", "/assets/statistics"})
@Tag(name = "Thống kê tài sản", description = "API aggregate số liệu tài sản, vật tư, mượn trả, ticket và kiểm kê")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('Admin')")
public class AssetStatisticsController {

    private final AssetStatisticsService assetStatisticsService;

    public AssetStatisticsController(AssetStatisticsService assetStatisticsService) {
        this.assetStatisticsService = assetStatisticsService;
    }

    @GetMapping("/bootstrap")
    @Operation(summary = "Tải dữ liệu thống kê tài sản", description = "Trả về số liệu aggregate để frontend render chart và bảng top.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy thống kê thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Chỉ quản trị viên được truy cập")
    })
    public ResponseEntity<AssetStatisticsResponse> getStatistics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Integer locationId
    ) {
        return ResponseEntity.ok(assetStatisticsService.getStatistics(fromDate, toDate, categoryId, locationId));
    }

    @GetMapping("/export")
    @Operation(summary = "Xuất Excel thống kê tài sản", description = "Xuất báo cáo Excel từ cùng nguồn aggregate của trang thống kê.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xuất thống kê thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Chỉ quản trị viên được truy cập"),
            @ApiResponse(responseCode = "500", description = "Lỗi xuất file Excel")
    })
    public ResponseEntity<byte[]> exportStatistics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Integer locationId
    ) {
        try {
            byte[] excelBytes = assetStatisticsService.exportStatisticsExcel(fromDate, toDate, categoryId, locationId);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.setContentDisposition(ContentDisposition.attachment().filename("thong-ke-tai-san.xlsx").build());
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(excelBytes);
        } catch (IOException ex) {
            throw new CustomException("Không thể xuất báo cáo thống kê tài sản.");
        }
    }
}

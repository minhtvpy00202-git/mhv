package com.poly.mhv.controller;

import com.poly.mhv.dto.maintenance.MaintenanceHistoryResponse;
import com.poly.mhv.dto.maintenance.MaintenanceReportRequest;
import com.poly.mhv.dto.maintenance.MaintenanceReportResponse;
import com.poly.mhv.service.MaintenanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/maintenance", "/maintenance"})
@Tag(name = "Báo hỏng", description = "API báo hỏng thiết bị và tra cứu lịch sử bảo trì")
@SecurityRequirement(name = "bearerAuth")
public class MaintenanceController {

    private final MaintenanceService maintenanceService;

    public MaintenanceController(MaintenanceService maintenanceService) {
        this.maintenanceService = maintenanceService;
    }

    @PostMapping(path = "/report", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Báo hỏng thiết bị", description = "Tạo mới một báo cáo hỏng hóc cho thiết bị.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Báo hỏng thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<MaintenanceReportResponse> report(@RequestBody MaintenanceReportRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(maintenanceService.report(request));
    }

    @PostMapping(path = "/report", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Báo hỏng thiết bị kèm ảnh", description = "Tạo mới báo cáo hỏng hóc với dữ liệu multipart/form-data và ảnh đính kèm.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Báo hỏng thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu hoặc ảnh không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<MaintenanceReportResponse> reportMultipart(
            @Parameter(description = "Mã QA của thiết bị cần báo hỏng", example = "AT0007")
            @RequestParam("assetQaCode") String assetQaCode,
            @Parameter(description = "Mô tả hỏng hóc hoặc triệu chứng gặp phải", example = "Loa bị rè và lúc có lúc mất tiếng.")
            @RequestParam("description") String description,
            @Parameter(description = "Mức độ ưu tiên, có thể bỏ trống", example = "MEDIUM")
            @RequestParam(name = "priority", required = false) String priority,
            @Parameter(
                    description = "Ảnh minh họa hỏng hóc đính kèm theo multipart/form-data",
                    schema = @Schema(type = "string", format = "binary")
            )
            @RequestPart(name = "image", required = false) MultipartFile image
    ) {
        MaintenanceReportRequest request = MaintenanceReportRequest.builder()
                .assetQaCode(assetQaCode)
                .description(description)
                .priority(priority)
                .build();
        return ResponseEntity.status(HttpStatus.CREATED).body(maintenanceService.report(request, image));
    }

    @GetMapping("/history/me")
    @Operation(summary = "Lấy lịch sử báo hỏng của tôi", description = "Lấy các bản ghi bảo trì do người dùng hiện tại tạo.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy lịch sử báo hỏng cá nhân thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<List<MaintenanceHistoryResponse>> getMyHistory() {
        return ResponseEntity.ok(maintenanceService.getMyHistory());
    }

    @GetMapping("/history")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Lấy toàn bộ lịch sử bảo trì", description = "Lấy danh sách lịch sử báo hỏng và bảo trì dành cho quản trị.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy lịch sử bảo trì thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Chỉ quản trị viên được phép truy cập")
    })
    public ResponseEntity<List<MaintenanceHistoryResponse>> getHistoryForAdmin() {
        return ResponseEntity.ok(maintenanceService.getAllForAdminHistory());
    }
}

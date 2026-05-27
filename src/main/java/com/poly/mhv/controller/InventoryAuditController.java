package com.poly.mhv.controller;

import com.poly.mhv.dto.inventory.InventoryAuditCreateRequest;
import com.poly.mhv.dto.inventory.InventoryAuditDetailResponse;
import com.poly.mhv.dto.inventory.InventoryAuditManagementBootstrapResponse;
import com.poly.mhv.dto.inventory.InventoryAuditScanRequest;
import com.poly.mhv.dto.inventory.InventoryAuditScanResultResponse;
import com.poly.mhv.dto.inventory.InventoryAuditSummaryResponse;
import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.service.InventoryAuditService;
import com.poly.mhv.service.LocationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
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
@RequestMapping({"/api/inventory-audits", "/inventory-audits"})
@Tag(name = "Kiểm kê", description = "API tạo phiên kiểm kê, quét thiết bị và chốt biên bản kiểm kê")
@SecurityRequirement(name = "bearerAuth")
public class InventoryAuditController {

    private final InventoryAuditService inventoryAuditService;
    private final LocationService locationService;

    public InventoryAuditController(InventoryAuditService inventoryAuditService, LocationService locationService) {
        this.inventoryAuditService = inventoryAuditService;
        this.locationService = locationService;
    }

    @PostMapping
    @Operation(summary = "Tạo phiên kiểm kê", description = "Khởi tạo một đợt kiểm kê cho phòng được chọn.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tạo phiên kiểm kê thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ hoặc phòng đang có kiểm kê mở"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<InventoryAuditSummaryResponse> createAudit(@RequestBody InventoryAuditCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryAuditService.createAudit(request));
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách kiểm kê", description = "Lấy danh sách các đợt kiểm kê, có thể lọc theo trạng thái.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách kiểm kê thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<PagedResponse<InventoryAuditSummaryResponse>> getAudits(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(inventoryAuditService.getAudits(page, size, status));
    }

    @GetMapping("/bootstrap")
    @Operation(summary = "Tải dữ liệu khởi tạo kiểm kê", description = "Trả về trang đầu danh sách phiên kiểm kê cùng danh sách phòng.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy dữ liệu khởi tạo kiểm kê thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<InventoryAuditManagementBootstrapResponse> getInventoryAuditBootstrap(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(new InventoryAuditManagementBootstrapResponse(
                inventoryAuditService.getAudits(page, size, status),
                locationService.getAllLocations(null)
        ));
    }

    @GetMapping("/active")
    @Operation(summary = "Lấy kiểm kê đang mở", description = "Lấy các đợt kiểm kê đang ở trạng thái mở để tiếp tục quét.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách kiểm kê đang mở thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    @PreAuthorize("hasAnyRole('Admin','TechSupport')")
    public ResponseEntity<List<InventoryAuditSummaryResponse>> getActiveAudits() {
        return ResponseEntity.ok(inventoryAuditService.getActiveAudits());
    }

    @GetMapping("/history/me")
    @Operation(summary = "Lấy lịch sử kiểm kê của tôi", description = "Lấy các đợt kiểm kê do người dùng hiện tại thực hiện.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy lịch sử kiểm kê cá nhân thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    @PreAuthorize("hasAnyRole('Admin','TechSupport')")
    public ResponseEntity<List<InventoryAuditSummaryResponse>> getMyAudits() {
        return ResponseEntity.ok(inventoryAuditService.getMyAudits());
    }

    @GetMapping("/{auditId}")
    @Operation(summary = "Lấy chi tiết kiểm kê", description = "Lấy chi tiết một phiên kiểm kê, bao gồm danh sách đã quét và thiếu.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy chi tiết kiểm kê thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy phiên kiểm kê")
    })
    @PreAuthorize("hasAnyRole('Admin','TechSupport')")
    public ResponseEntity<InventoryAuditDetailResponse> getDetail(@PathVariable Integer auditId) {
        return ResponseEntity.ok(inventoryAuditService.getDetail(auditId));
    }

    @PostMapping("/{auditId}/scan")
    @Operation(summary = "Quét thiết bị trong kiểm kê", description = "Ghi nhận một thiết bị đã được quét trong phiên kiểm kê.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Quét thiết bị thành công"),
            @ApiResponse(responseCode = "400", description = "Thiết bị không hợp lệ hoặc không thuộc phòng kiểm kê"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy phiên kiểm kê")
    })
    @PreAuthorize("hasAnyRole('Admin','TechSupport')")
    public ResponseEntity<InventoryAuditScanResultResponse> scanAsset(
            @PathVariable Integer auditId,
            @RequestBody InventoryAuditScanRequest request
    ) {
        return ResponseEntity.ok(inventoryAuditService.scanAsset(auditId, request));
    }

    @PostMapping("/{auditId}/complete")
    @Operation(summary = "Hoàn tất kiểm kê", description = "Khóa phiên kiểm kê và sinh kết quả tổng hợp cuối cùng.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Hoàn tất kiểm kê thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy phiên kiểm kê")
    })
    @PreAuthorize("hasAnyRole('Admin','TechSupport')")
    public ResponseEntity<InventoryAuditDetailResponse> completeAudit(@PathVariable Integer auditId) {
        return ResponseEntity.ok(inventoryAuditService.completeAudit(auditId));
    }

    @PostMapping("/{auditId}/missing/{assetQaCode}/found")
    @Operation(summary = "Đánh dấu đã tìm thấy thiết bị thiếu", description = "Xác nhận thiết bị thiếu đã được tìm thấy trong phiên kiểm kê.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cập nhật trạng thái thiếu thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy phiên kiểm kê hoặc thiết bị")
    })
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<InventoryAuditDetailResponse> resolveFound(
            @PathVariable Integer auditId,
            @PathVariable String assetQaCode
    ) {
        return ResponseEntity.ok(inventoryAuditService.resolveMissingFound(auditId, assetQaCode));
    }

    @PostMapping("/{auditId}/missing/{assetQaCode}/lost")
    @Operation(summary = "Đánh dấu thất lạc thiết bị thiếu", description = "Chốt trạng thái thất lạc cho thiết bị đang bị thiếu trong phiên kiểm kê.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Đánh dấu thất lạc thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy phiên kiểm kê hoặc thiết bị")
    })
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<InventoryAuditDetailResponse> resolveLost(
            @PathVariable Integer auditId,
            @PathVariable String assetQaCode
    ) {
        return ResponseEntity.ok(inventoryAuditService.resolveMissingLost(auditId, assetQaCode));
    }
}

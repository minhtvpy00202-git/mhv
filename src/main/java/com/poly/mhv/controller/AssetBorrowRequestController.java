package com.poly.mhv.controller;

import com.poly.mhv.dto.inquiry.AssetBorrowRequestCreateRequest;
import com.poly.mhv.dto.inquiry.AssetBorrowRequestResponse;
import com.poly.mhv.dto.inquiry.BorrowRequestDecisionRequest;
import com.poly.mhv.dto.usage.CheckinRequest;
import com.poly.mhv.service.AssetBorrowRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
@RequestMapping({"/api/borrow-requests", "/borrow-requests"})
@Tag(name = "Phiếu mượn thiết bị", description = "API tạo và duyệt phiếu mượn thiết bị")
@SecurityRequirement(name = "bearerAuth")
public class AssetBorrowRequestController {

    private final AssetBorrowRequestService assetBorrowRequestService;

    public AssetBorrowRequestController(AssetBorrowRequestService assetBorrowRequestService) {
        this.assetBorrowRequestService = assetBorrowRequestService;
    }

    @PostMapping
    @PreAuthorize("hasRole('NhanVien')")
    @Operation(summary = "Tạo phiếu mượn thiết bị", description = "Nhân viên tạo yêu cầu mượn hoặc đặt mượn thiết bị để chờ Admin duyệt.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tạo phiếu mượn thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<AssetBorrowRequestResponse> create(@Valid @RequestBody AssetBorrowRequestCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assetBorrowRequestService.create(request));
    }

    @GetMapping("/mine")
    @Operation(summary = "Lấy phiếu mượn của tôi", description = "Trả về danh sách phiếu mượn thiết bị của người dùng hiện tại.")
    public ResponseEntity<List<AssetBorrowRequestResponse>> getMine() {
        return ResponseEntity.ok(assetBorrowRequestService.getMine());
    }

    @PostMapping("/request-return")
    @PreAuthorize("hasRole('NhanVien')")
    @Operation(summary = "Gửi yêu cầu trả thiết bị", description = "Nhân viên quét mã QR để gửi yêu cầu trả thiết bị cho Admin xác nhận.")
    public ResponseEntity<AssetBorrowRequestResponse> requestReturn(@Valid @RequestBody CheckinRequest request) {
        return ResponseEntity.ok(assetBorrowRequestService.requestReturn(request));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('NhanVien')")
    @Operation(summary = "Hủy phiếu mượn của tôi", description = "Nhân viên hủy phiếu mượn đang chờ duyệt hoặc đang giữ chỗ khi không còn nhu cầu.")
    public ResponseEntity<AssetBorrowRequestResponse> cancelMine(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) BorrowRequestDecisionRequest request
    ) {
        return ResponseEntity.ok(assetBorrowRequestService.cancelMine(id, request));
    }

    @GetMapping("/inbox")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Lấy danh sách phiếu mượn chờ Admin", description = "Admin lấy danh sách phiếu mượn theo trạng thái để duyệt.")
    public ResponseEntity<List<AssetBorrowRequestResponse>> getInbox(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(assetBorrowRequestService.getInbox(status));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết phiếu mượn", description = "Admin hoặc chính người tạo xem chi tiết phiếu mượn.")
    public ResponseEntity<AssetBorrowRequestResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(assetBorrowRequestService.getById(id));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Duyệt phiếu mượn", description = "Admin duyệt phiếu mượn và bắt đầu ghi nhận mượn thiết bị.")
    public ResponseEntity<AssetBorrowRequestResponse> approve(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) BorrowRequestDecisionRequest request
    ) {
        return ResponseEntity.ok(assetBorrowRequestService.approve(id, request));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Từ chối phiếu mượn", description = "Admin từ chối phiếu mượn thiết bị.")
    public ResponseEntity<AssetBorrowRequestResponse> reject(
            @PathVariable Long id,
            @Valid @RequestBody BorrowRequestDecisionRequest request
    ) {
        return ResponseEntity.ok(assetBorrowRequestService.reject(id, request));
    }

    @PostMapping("/{id}/confirm-return")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Xác nhận đã trả thiết bị", description = "Admin xác nhận yêu cầu trả và cập nhật thiết bị về vị trí gốc.")
    public ResponseEntity<AssetBorrowRequestResponse> confirmReturn(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) BorrowRequestDecisionRequest request
    ) {
        return ResponseEntity.ok(assetBorrowRequestService.confirmReturn(id, request));
    }
}

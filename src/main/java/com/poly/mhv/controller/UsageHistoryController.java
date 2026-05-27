package com.poly.mhv.controller;

import com.poly.mhv.dto.usage.CheckinRequest;
import com.poly.mhv.dto.usage.CheckoutRequest;
import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.dto.usage.UsageHistoryAdminResponse;
import com.poly.mhv.dto.usage.UsageHistoryResponse;
import com.poly.mhv.service.UsageHistoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@RequestMapping({"/api/usage", "/usage"})
@Tag(name = "Mượn trả thiết bị", description = "API check-out, check-in và tra cứu lịch sử mượn trả")
@SecurityRequirement(name = "bearerAuth")
public class UsageHistoryController {

    private final UsageHistoryService usageHistoryService;

    public UsageHistoryController(UsageHistoryService usageHistoryService) {
        this.usageHistoryService = usageHistoryService;
    }

    @PostMapping("/checkout")
    @Operation(summary = "Mượn thiết bị", description = "Thực hiện check-out thiết bị từ phòng gốc sang phòng sử dụng.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Mượn thiết bị thành công"),
            @ApiResponse(responseCode = "400", description = "Thiết bị không thể mượn hoặc dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<UsageHistoryResponse> checkout(@RequestBody CheckoutRequest request) {
        return ResponseEntity.ok(usageHistoryService.checkout(request));
    }

    @PostMapping("/checkin")
    @Operation(summary = "Trả thiết bị", description = "Thực hiện check-in thiết bị về phòng gốc.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Trả thiết bị thành công"),
            @ApiResponse(responseCode = "400", description = "Thiết bị không có phiên mượn đang mở hoặc dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<UsageHistoryResponse> checkin(@RequestBody CheckinRequest request) {
        return ResponseEntity.ok(usageHistoryService.checkin(request));
    }

    @GetMapping("/history")
    @Operation(summary = "Lấy lịch sử mượn trả", description = "Lọc lịch sử mượn trả dành cho quản trị theo thiết bị, phòng, người dùng và khoảng ngày.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy lịch sử mượn trả thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<PagedResponse<UsageHistoryAdminResponse>> getHistoryForAdmin(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String assetName,
            @RequestParam(required = false) Integer borrowedLocationId,
            @RequestParam(required = false) Integer userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String sortKey,
            @RequestParam(required = false) String sortDirection
    ) {
        return ResponseEntity.ok(usageHistoryService.searchForAdmin(
                page,
                size,
                assetName,
                borrowedLocationId,
                userId,
                startDate,
                endDate,
                sortKey,
                sortDirection
        ));
    }

    @GetMapping("/history/me")
    @Operation(summary = "Lấy lịch sử của tôi", description = "Lấy lịch sử mượn trả của người dùng hiện tại.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy lịch sử cá nhân thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<List<UsageHistoryAdminResponse>> getMyHistory() {
        return ResponseEntity.ok(usageHistoryService.getMyHistory());
    }
}

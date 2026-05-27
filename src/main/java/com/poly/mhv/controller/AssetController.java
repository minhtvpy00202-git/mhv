package com.poly.mhv.controller;

import com.poly.mhv.dto.asset.AssetCreateRequest;
import com.poly.mhv.dto.asset.AssetManagementBootstrapResponse;
import com.poly.mhv.dto.asset.AssetResponse;
import com.poly.mhv.dto.asset.AssetUpdateRequest;
import com.poly.mhv.dto.asset.ConsumableIssueRequest;
import com.poly.mhv.dto.asset.ConsumableIssueResponse;
import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.service.CategoryService;
import com.poly.mhv.service.LocationService;
import com.poly.mhv.service.AssetService;
import com.poly.mhv.service.SupplierService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/assets", "/assets"})
@Tag(name = "Thiết bị", description = "API quản lý thiết bị và tra cứu thông tin tài sản")
@SecurityRequirement(name = "bearerAuth")
public class AssetController {

    private final AssetService assetService;
    private final CategoryService categoryService;
    private final LocationService locationService;
    private final SupplierService supplierService;

    public AssetController(
            AssetService assetService,
            CategoryService categoryService,
            LocationService locationService,
            SupplierService supplierService
    ) {
        this.assetService = assetService;
        this.categoryService = categoryService;
        this.locationService = locationService;
        this.supplierService = supplierService;
    }

    @PostMapping
    @Operation(summary = "Tạo thiết bị", description = "Tạo mới thiết bị. Mã QA sẽ được backend tự sinh theo loại thiết bị.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tạo thiết bị thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền tạo thiết bị")
    })
    public ResponseEntity<AssetResponse> createAsset(@Valid @RequestBody AssetCreateRequest request) {
        AssetResponse response = assetService.createAsset(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{qaCode}")
    @Operation(summary = "Cập nhật thiết bị", description = "Cập nhật thông tin thiết bị theo mã QA.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cập nhật thiết bị thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy thiết bị")
    })
    public ResponseEntity<AssetResponse> updateAsset(
            @PathVariable String qaCode,
            @Valid @RequestBody AssetUpdateRequest request
    ) {
        return ResponseEntity.ok(assetService.updateAsset(qaCode, request));
    }

    @DeleteMapping("/{qaCode}")
    @Operation(summary = "Xóa thiết bị", description = "Xóa thiết bị theo mã QA nếu không còn ràng buộc nghiệp vụ.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xóa thiết bị thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy thiết bị")
    })
    public ResponseEntity<Map<String, String>> deleteAsset(@PathVariable String qaCode) {
        assetService.deleteAsset(qaCode);
        return ResponseEntity.ok(Map.of("message", "Xóa thiết bị thành công."));
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách thiết bị", description = "Phân trang và lọc thiết bị theo tên, trạng thái, loại thiết bị, phòng và sắp xếp.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách thiết bị thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<PagedResponse<AssetResponse>> getAllAssets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String trackingMode,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Integer locationId,
            @RequestParam(required = false) String sortKey,
            @RequestParam(required = false) String sortDirection
    ) {
        return ResponseEntity.ok(assetService.getAssets(
                page,
                size,
                name,
                status,
                trackingMode,
                categoryId,
                locationId,
                sortKey,
                sortDirection
        ));
    }

    @GetMapping("/bootstrap")
    @Operation(summary = "Tải dữ liệu khởi tạo quản lý thiết bị", description = "Trả về trang dữ liệu thiết bị đầu tiên cùng danh mục phòng, loại thiết bị và nhà cung cấp.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy dữ liệu khởi tạo thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<AssetManagementBootstrapResponse> getAssetManagementBootstrap(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String trackingMode,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Integer locationId,
            @RequestParam(required = false) String sortKey,
            @RequestParam(required = false) String sortDirection
    ) {
        return ResponseEntity.ok(new AssetManagementBootstrapResponse(
                assetService.getAssets(page, size, name, status, trackingMode, categoryId, locationId, sortKey, sortDirection),
                locationService.getAllLocations(null),
                categoryService.getCategoryOptions(),
                supplierService.getAll(null)
        ));
    }

    @PostMapping("/{qaCode}/issues")
    @Operation(summary = "Cấp phát vật tư tiêu hao", description = "Giảm tồn kho và lưu lịch sử cấp phát cho vật tư tiêu hao.")
    public ResponseEntity<ConsumableIssueResponse> issueConsumable(
            @PathVariable String qaCode,
            @Valid @RequestBody ConsumableIssueRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assetService.issueConsumable(qaCode, request));
    }

    @GetMapping("/{qaCode}/issues")
    @Operation(summary = "Lấy lịch sử cấp phát vật tư", description = "Trả về các lần cấp phát của vật tư tiêu hao theo mã QA.")
    public ResponseEntity<List<ConsumableIssueResponse>> getConsumableIssueHistory(@PathVariable String qaCode) {
        return ResponseEntity.ok(assetService.getConsumableIssueHistory(qaCode));
    }

    @GetMapping("/{qaCode}")
    @Operation(summary = "Lấy chi tiết thiết bị", description = "Tra cứu chi tiết một thiết bị theo mã QA.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy chi tiết thiết bị thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy thiết bị")
    })
    public ResponseEntity<AssetResponse> getAssetByQaCode(@PathVariable String qaCode) {
        return ResponseEntity.ok(assetService.getAssetByQaCode(qaCode));
    }

    @GetMapping("/{qaCode}/qr")
    @Operation(summary = "Lấy mã QR của thiết bị", description = "Sinh hoặc lấy cache ảnh QR base64 của thiết bị theo mã QA.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy mã QR thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy thiết bị")
    })
    public ResponseEntity<Map<String, String>> getAssetQrByQaCode(@PathVariable String qaCode) {
        return ResponseEntity.ok(assetService.getAssetQrByQaCode(qaCode));
    }
}

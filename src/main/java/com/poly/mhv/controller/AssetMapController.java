package com.poly.mhv.controller;

import com.poly.mhv.dto.assetmap.AssetMapAssetResponse;
import com.poly.mhv.dto.assetmap.AssetMapBootstrapResponse;
import com.poly.mhv.dto.assetmap.AreaTypeCatalogCreateRequest;
import com.poly.mhv.dto.assetmap.AreaTypeCatalogResponse;
import com.poly.mhv.dto.assetmap.AreaTypeCatalogUpdateRequest;
import com.poly.mhv.dto.assetmap.FloorLayoutSaveRequest;
import com.poly.mhv.dto.assetmap.MapFloorCreateRequest;
import com.poly.mhv.dto.assetmap.MapFloorResponse;
import com.poly.mhv.dto.assetmap.MapFloorUpdateRequest;
import com.poly.mhv.dto.assetmapimport.AssetMapImportAnalyzeResponse;
import com.poly.mhv.dto.assetmapimport.AssetMapImportApplyRequest;
import com.poly.mhv.dto.assetmapimport.AssetMapImportApplyResponse;
import com.poly.mhv.service.AssetMapImportService;
import com.poly.mhv.service.AssetMapService;
import com.poly.mhv.service.AreaTypeCatalogService;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/asset-map", "/asset-map"})
@Tag(name = "So do dinh vi tai san", description = "API quan ly tang, so do phong va tim tai san tren so do")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('Admin')")
public class AssetMapController {

    private final AssetMapService assetMapService;
    private final AssetMapImportService assetMapImportService;
    private final AreaTypeCatalogService areaTypeCatalogService;

    public AssetMapController(
            AssetMapService assetMapService,
            AssetMapImportService assetMapImportService,
            AreaTypeCatalogService areaTypeCatalogService
    ) {
        this.assetMapService = assetMapService;
        this.assetMapImportService = assetMapImportService;
        this.areaTypeCatalogService = areaTypeCatalogService;
    }

    @GetMapping("/bootstrap")
    @Operation(summary = "Tai du lieu khoi tao so do", description = "Tra ve danh sach tang, vung phong, phong va loai thiet bi cho man so do.")
    public ResponseEntity<AssetMapBootstrapResponse> getBootstrap() {
        return ResponseEntity.ok(assetMapService.getBootstrap());
    }

    @GetMapping("/floors")
    @Operation(summary = "Lay danh sach tang", description = "Tra ve toan bo tang cung vung phong da ve tren moi tang.")
    public ResponseEntity<List<MapFloorResponse>> getFloors() {
        return ResponseEntity.ok(assetMapService.getFloors());
    }

    @GetMapping("/area-types")
    @Operation(summary = "Lấy danh mục loại khu vực", description = "Trả về danh sách loại khu vực dùng cho sơ đồ và form tạo phòng.")
    public ResponseEntity<List<AreaTypeCatalogResponse>> getAreaTypes() {
        return ResponseEntity.ok(areaTypeCatalogService.getAllAreaTypes());
    }

    @PostMapping("/area-types")
    @Operation(summary = "Tạo loại khu vực", description = "Admin tạo thêm loại khu vực mới để dùng trong sơ đồ.")
    public ResponseEntity<AreaTypeCatalogResponse> createAreaType(@Valid @RequestBody AreaTypeCatalogCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(areaTypeCatalogService.createAreaType(request));
    }

    @PutMapping("/area-types/{id}")
    @Operation(summary = "Cập nhật loại khu vực", description = "Admin cập nhật nhãn hiển thị, mô tả và mặc định chứa tài sản.")
    public ResponseEntity<AreaTypeCatalogResponse> updateAreaType(
            @PathVariable Integer id,
            @Valid @RequestBody AreaTypeCatalogUpdateRequest request
    ) {
        return ResponseEntity.ok(areaTypeCatalogService.updateAreaType(id, request));
    }

    @DeleteMapping("/area-types/{id}")
    @Operation(summary = "Xóa loại khu vực", description = "Chỉ xóa được loại khu vực tùy chỉnh chưa được dùng trên sơ đồ.")
    public ResponseEntity<Map<String, String>> deleteAreaType(@PathVariable Integer id) {
        areaTypeCatalogService.deleteAreaType(id);
        return ResponseEntity.ok(Map.of("message", "Xóa loại khu vực thành công."));
    }

    @PostMapping("/floors")
    @Operation(summary = "Tao tang moi", description = "Admin tao tang moi cho so do dinh vi tai san.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tao tang thanh cong"),
            @ApiResponse(responseCode = "400", description = "Du lieu khong hop le")
    })
    public ResponseEntity<MapFloorResponse> createFloor(@Valid @RequestBody MapFloorCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assetMapService.createFloor(request));
    }

    @PutMapping("/floors/{floorId}")
    @Operation(summary = "Cap nhat tang", description = "Admin doi ten tang, so hang, so cot hoac thu tu hien thi cua tang.")
    public ResponseEntity<MapFloorResponse> updateFloor(
            @PathVariable Integer floorId,
            @Valid @RequestBody MapFloorUpdateRequest request
    ) {
        return ResponseEntity.ok(assetMapService.updateFloor(floorId, request));
    }

    @DeleteMapping("/floors/{floorId}")
    @Operation(summary = "Xoa tang", description = "Xoa tang neu chua co phong nghiep vu hoac so do phong gan vao tang do.")
    public ResponseEntity<Map<String, String>> deleteFloor(@PathVariable Integer floorId) {
        assetMapService.deleteFloor(floorId);
        return ResponseEntity.ok(Map.of("message", "Xoa tang thanh cong."));
    }

    @PutMapping("/floors/{floorId}/layout")
    @Operation(summary = "Luu so do mot tang", description = "Luu toan bo vung phong tren grid cua mot tang, gom tao phong moi hoac gan phong co san.")
    public ResponseEntity<MapFloorResponse> saveFloorLayout(
            @PathVariable Integer floorId,
            @Valid @RequestBody FloorLayoutSaveRequest request
    ) {
        return ResponseEntity.ok(assetMapService.saveFloorLayout(floorId, request));
    }

    @GetMapping("/assets/search")
    @Operation(summary = "Tim tai san tren so do", description = "Tim kiem tai san theo ma QA, ten, loai hoac phong de hien thi marker tren so do.")
    public ResponseEntity<List<AssetMapAssetResponse>> searchAssets(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Integer locationId,
            @RequestParam(required = false) Integer floorId,
            @RequestParam(required = false) String trackingMode
    ) {
        return ResponseEntity.ok(assetMapService.searchAssets(keyword, categoryId, locationId, floorId, trackingMode));
    }

    @PostMapping("/imports/analyze")
    @Operation(summary = "Upload anh nen so do", description = "Nhan anh PNG/JPG/JPEG, luu preview va metadata kich thuoc de admin tao tang IMAGE roi tu ve phong tren anh.")
    public ResponseEntity<AssetMapImportAnalyzeResponse> analyzeImport(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(assetMapImportService.analyzeImportImage(file));
    }

    @PostMapping("/imports/{sessionId}/apply")
    @Operation(summary = "Tao tang IMAGE tu anh da chon", description = "Dung anh da upload lam nen so do, tao MapFloor kieu IMAGE va khong tu sinh phong/vung nao.")
    public ResponseEntity<AssetMapImportApplyResponse> applyImport(
            @PathVariable String sessionId,
            @Valid @RequestBody AssetMapImportApplyRequest request
    ) {
        return ResponseEntity.ok(assetMapImportService.applyImportSession(sessionId, request.getDrawingIds()));
    }

    @DeleteMapping("/imports/{sessionId}")
    @Operation(summary = "Xoa phien import tam", description = "Xoa du lieu import tam tren local disk sau khi dong modal hoac tao so do xong.")
    public ResponseEntity<Void> deleteImportSession(@PathVariable String sessionId) {
        assetMapImportService.deleteSession(sessionId);
        return ResponseEntity.noContent().build();
    }
}

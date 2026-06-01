package com.poly.mhv.controller;

import com.poly.mhv.dto.location.LocationCreateRequest;
import com.poly.mhv.dto.location.LocationResponse;
import com.poly.mhv.dto.location.LocationUpdateRequest;
import com.poly.mhv.service.LocationService;
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
@RequestMapping({"/api/locations", "/locations"})
@Tag(name = "Phòng", description = "API quản lý phòng và vị trí lưu trữ tài sản")
@SecurityRequirement(name = "bearerAuth")
public class LocationController {

    private final LocationService locationService;

    public LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách phòng", description = "Lấy toàn bộ phòng hoặc lọc theo tên phòng, khu vực.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách phòng thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<List<LocationResponse>> getAllLocations(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean hasAsset
    ) {
        return ResponseEntity.ok(locationService.getAllLocations(keyword, hasAsset));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết phòng", description = "Tra cứu chi tiết một phòng theo id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy chi tiết phòng thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy phòng")
    })
    public ResponseEntity<LocationResponse> getLocationById(@PathVariable Integer id) {
        return ResponseEntity.ok(locationService.getLocationById(id));
    }

    @PostMapping
    @Operation(summary = "Tạo phòng", description = "Tạo mới phòng hoặc vị trí lưu trữ tài sản.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tạo phòng thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ hoặc tên phòng bị trùng"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<LocationResponse> createLocation(@Valid @RequestBody LocationCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(locationService.createLocation(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật phòng", description = "Cập nhật thông tin phòng theo id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cập nhật phòng thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy phòng")
    })
    public ResponseEntity<LocationResponse> updateLocation(
            @PathVariable Integer id,
            @Valid @RequestBody LocationUpdateRequest request
    ) {
        return ResponseEntity.ok(locationService.updateLocation(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa phòng", description = "Xóa phòng nếu chưa bị ràng buộc bởi thiết bị hoặc lịch sử mượn trả.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xóa phòng thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy phòng")
    })
    public ResponseEntity<Map<String, String>> deleteLocation(@PathVariable Integer id) {
        locationService.deleteLocation(id);
        return ResponseEntity.ok(Map.of("message", "Xóa phòng thành công."));
    }
}

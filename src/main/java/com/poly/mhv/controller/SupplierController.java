package com.poly.mhv.controller;

import com.poly.mhv.dto.supplier.SupplierCreateRequest;
import com.poly.mhv.dto.supplier.SupplierResponse;
import com.poly.mhv.dto.supplier.SupplierUpdateRequest;
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

@RestController
@RequestMapping({"/api/suppliers", "/suppliers"})
@PreAuthorize("hasRole('Admin')")
@Tag(name = "Nhà cung cấp", description = "API quản lý danh mục nhà cung cấp tài sản")
@SecurityRequirement(name = "bearerAuth")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách nhà cung cấp", description = "Lấy toàn bộ nhà cung cấp hoặc lọc theo tên.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách nhà cung cấp thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền truy cập")
    })
    public ResponseEntity<List<SupplierResponse>> getAll(@RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(supplierService.getAll(keyword));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết nhà cung cấp", description = "Tra cứu chi tiết một nhà cung cấp theo id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy chi tiết nhà cung cấp thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền truy cập"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy nhà cung cấp")
    })
    public ResponseEntity<SupplierResponse> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(supplierService.getById(id));
    }

    @PostMapping
    @Operation(summary = "Tạo nhà cung cấp", description = "Tạo mới một nhà cung cấp để gán cho thiết bị.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tạo nhà cung cấp thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ hoặc tên bị trùng"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền tạo")
    })
    public ResponseEntity<SupplierResponse> create(@Valid @RequestBody SupplierCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(supplierService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật nhà cung cấp", description = "Cập nhật tên nhà cung cấp theo id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cập nhật nhà cung cấp thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền cập nhật"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy nhà cung cấp")
    })
    public ResponseEntity<SupplierResponse> update(
            @PathVariable Integer id,
            @Valid @RequestBody SupplierUpdateRequest request
    ) {
        return ResponseEntity.ok(supplierService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa nhà cung cấp", description = "Xóa nhà cung cấp nếu chưa được gán cho thiết bị nào.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xóa nhà cung cấp thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền xóa"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy nhà cung cấp")
    })
    public ResponseEntity<Map<String, String>> delete(@PathVariable Integer id) {
        supplierService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Xóa nhà cung cấp thành công."));
    }
}

package com.poly.mhv.controller;

import com.poly.mhv.dto.techsupporttype.TechSupportTypeCreateRequest;
import com.poly.mhv.dto.techsupporttype.TechSupportTypeResponse;
import com.poly.mhv.dto.techsupporttype.TechSupportTypeUpdateRequest;
import com.poly.mhv.service.TechSupportTypeService;
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
@RequestMapping({"/api/tech-support-types", "/tech-support-types"})
@PreAuthorize("hasRole('Admin')")
@Tag(name = "Loại kỹ thuật viên", description = "API quản lý danh mục chuyên môn kỹ thuật viên")
@SecurityRequirement(name = "bearerAuth")
public class TechSupportTypeController {

    private final TechSupportTypeService techSupportTypeService;

    public TechSupportTypeController(TechSupportTypeService techSupportTypeService) {
        this.techSupportTypeService = techSupportTypeService;
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách loại kỹ thuật viên", description = "Lấy toàn bộ danh mục loại kỹ thuật viên hoặc lọc theo tên.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách loại kỹ thuật viên thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền truy cập")
    })
    public ResponseEntity<List<TechSupportTypeResponse>> getAll(@RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(techSupportTypeService.getAll(keyword));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết loại kỹ thuật viên", description = "Tra cứu chi tiết một loại kỹ thuật viên theo id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy chi tiết loại kỹ thuật viên thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền truy cập"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy loại kỹ thuật viên")
    })
    public ResponseEntity<TechSupportTypeResponse> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(techSupportTypeService.getById(id));
    }

    @PostMapping
    @Operation(summary = "Tạo loại kỹ thuật viên", description = "Tạo mới một chuyên môn kỹ thuật viên để gán cho loại thiết bị và tài khoản.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tạo loại kỹ thuật viên thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ hoặc tên bị trùng"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền tạo")
    })
    public ResponseEntity<TechSupportTypeResponse> create(@Valid @RequestBody TechSupportTypeCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(techSupportTypeService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật loại kỹ thuật viên", description = "Cập nhật tên chuyên môn kỹ thuật viên theo id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cập nhật loại kỹ thuật viên thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền cập nhật"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy loại kỹ thuật viên")
    })
    public ResponseEntity<TechSupportTypeResponse> update(
            @PathVariable Integer id,
            @Valid @RequestBody TechSupportTypeUpdateRequest request
    ) {
        return ResponseEntity.ok(techSupportTypeService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa loại kỹ thuật viên", description = "Xóa loại kỹ thuật viên nếu chưa được gán cho loại thiết bị hoặc tài khoản nào.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xóa loại kỹ thuật viên thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền xóa"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy loại kỹ thuật viên")
    })
    public ResponseEntity<Map<String, String>> delete(@PathVariable Integer id) {
        techSupportTypeService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Xóa loại kỹ thuật viên thành công."));
    }
}

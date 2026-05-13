package com.poly.mhv.controller;

import com.poly.mhv.dto.category.CategoryCreateRequest;
import com.poly.mhv.dto.category.CategoryResponse;
import com.poly.mhv.dto.category.CategoryUpdateRequest;
import com.poly.mhv.service.CategoryService;
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
@RequestMapping({"/api/categories", "/categories"})
@Tag(name = "Loại thiết bị", description = "API quản lý danh mục loại thiết bị")
@SecurityRequirement(name = "bearerAuth")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách loại thiết bị", description = "Lấy toàn bộ loại thiết bị hoặc lọc theo từ khóa và loại kỹ thuật viên phụ trách.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách loại thiết bị thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<List<CategoryResponse>> getAllCategories(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer techTypeId
    ) {
        return ResponseEntity.ok(categoryService.getAllCategories(keyword, techTypeId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Lấy chi tiết loại thiết bị", description = "Tra cứu chi tiết một loại thiết bị theo id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy chi tiết loại thiết bị thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy loại thiết bị")
    })
    public ResponseEntity<CategoryResponse> getCategoryById(@PathVariable Integer id) {
        return ResponseEntity.ok(categoryService.getCategoryById(id));
    }

    @PostMapping
    @Operation(summary = "Tạo loại thiết bị", description = "Tạo mới loại thiết bị. Code prefix được backend tự sinh từ tên loại thiết bị.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tạo loại thiết bị thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ hoặc tên bị trùng"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Không có quyền tạo loại thiết bị")
    })
    public ResponseEntity<CategoryResponse> createCategory(@Valid @RequestBody CategoryCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.createCategory(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật loại thiết bị", description = "Cập nhật thông tin loại thiết bị theo id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cập nhật loại thiết bị thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy loại thiết bị")
    })
    public ResponseEntity<CategoryResponse> updateCategory(
            @PathVariable Integer id,
            @Valid @RequestBody CategoryUpdateRequest request
    ) {
        return ResponseEntity.ok(categoryService.updateCategory(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa loại thiết bị", description = "Xóa loại thiết bị nếu chưa được gán cho thiết bị nào.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xóa loại thiết bị thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy loại thiết bị")
    })
    public ResponseEntity<Map<String, String>> deleteCategory(@PathVariable Integer id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.ok(Map.of("message", "Xóa loại thiết bị thành công."));
    }
}

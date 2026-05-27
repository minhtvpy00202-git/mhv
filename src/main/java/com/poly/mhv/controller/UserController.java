package com.poly.mhv.controller;

import com.poly.mhv.dto.user.UserOptionResponse;
import com.poly.mhv.dto.user.UserAdminRequest;
import com.poly.mhv.dto.user.UserAdminResponse;
import com.poly.mhv.dto.user.UserPageResponse;
import com.poly.mhv.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
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
@RequestMapping({"/api/users", "/users"})
@Tag(name = "Tài khoản", description = "API quản lý tài khoản người dùng và danh sách mượn thiết bị")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/borrowers")
    @Operation(summary = "Lấy danh sách người mượn", description = "Lấy danh sách người dùng có thể thực hiện mượn thiết bị.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách người mượn thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực")
    })
    public ResponseEntity<List<UserOptionResponse>> getBorrowers() {
        return ResponseEntity.ok(userService.getBorrowers());
    }

    @GetMapping("/tech-supports")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Lấy danh sách kỹ thuật viên", description = "Lấy toàn bộ tài khoản kỹ thuật viên để điều phối ticket.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách kỹ thuật viên thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Chỉ quản trị viên được phép truy cập")
    })
    public ResponseEntity<List<UserAdminResponse>> getTechSupportUsers() {
        return ResponseEntity.ok(userService.getTechSupportUsers());
    }

    @GetMapping
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Lấy danh sách tài khoản", description = "Phân trang và lọc tài khoản theo từ khóa, vai trò, trạng thái.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Lấy danh sách tài khoản thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Chỉ quản trị viên được phép truy cập")
    })
    public ResponseEntity<UserPageResponse> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(userService.getUsers(page, size, keyword, role, status));
    }

    @PostMapping
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Tạo tài khoản", description = "Tạo mới tài khoản người dùng, bao gồm gán nhiều chuyên môn cho kỹ thuật viên.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tạo tài khoản thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ hoặc username bị trùng"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Chỉ quản trị viên được phép tạo tài khoản")
    })
    public ResponseEntity<UserAdminResponse> createUser(@RequestBody UserAdminRequest request) {
        return ResponseEntity.ok(userService.createUser(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Cập nhật tài khoản", description = "Cập nhật thông tin tài khoản và danh sách chuyên môn của người dùng.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cập nhật tài khoản thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Chỉ quản trị viên được phép cập nhật"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy tài khoản")
    })
    public ResponseEntity<UserAdminResponse> updateUser(@PathVariable Integer id, @RequestBody UserAdminRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Xóa tài khoản", description = "Xóa tài khoản người dùng theo id.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Xóa tài khoản thành công"),
            @ApiResponse(responseCode = "401", description = "Chưa xác thực"),
            @ApiResponse(responseCode = "403", description = "Chỉ quản trị viên được phép xóa"),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy tài khoản")
    })
    public ResponseEntity<Map<String, String>> deleteUser(@PathVariable Integer id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(Map.of("message", "Xóa tài khoản thành công."));
    }
}

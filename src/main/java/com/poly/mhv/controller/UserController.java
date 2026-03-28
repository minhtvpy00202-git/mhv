package com.poly.mhv.controller;

import com.poly.mhv.dto.user.UserOptionResponse;
import com.poly.mhv.dto.user.UserAdminRequest;
import com.poly.mhv.dto.user.UserAdminResponse;
import com.poly.mhv.dto.user.UserPageResponse;
import com.poly.mhv.service.UserService;
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
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/borrowers")
    public ResponseEntity<List<UserOptionResponse>> getBorrowers() {
        return ResponseEntity.ok(userService.getBorrowers());
    }

    @GetMapping
    @PreAuthorize("hasRole('Admin')")
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
    public ResponseEntity<UserAdminResponse> createUser(@RequestBody UserAdminRequest request) {
        return ResponseEntity.ok(userService.createUser(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<UserAdminResponse> updateUser(@PathVariable Integer id, @RequestBody UserAdminRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<Map<String, String>> deleteUser(@PathVariable Integer id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(Map.of("message", "Xóa tài khoản thành công."));
    }
}

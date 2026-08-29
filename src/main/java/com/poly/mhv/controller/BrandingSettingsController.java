package com.poly.mhv.controller;

import com.poly.mhv.dto.settings.BrandingSettingsRequest;
import com.poly.mhv.dto.settings.BrandingSettingsResponse;
import com.poly.mhv.service.BrandingSettingsService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/branding", "/branding"})
public class BrandingSettingsController {

    private final BrandingSettingsService brandingSettingsService;

    // Tiêm service xử lý việc đọc và cập nhật cấu hình thương hiệu hệ thống.
    public BrandingSettingsController(BrandingSettingsService brandingSettingsService) {
        this.brandingSettingsService = brandingSettingsService;
    }

    @GetMapping
    // Trả về cấu hình branding hiện tại để frontend hiển thị trên login, sidebar và các màn hình khác.
    public ResponseEntity<BrandingSettingsResponse> getBrandingSettings() {
        return ResponseEntity.ok(brandingSettingsService.getBrandingSettings());
    }

    @PutMapping
    @PreAuthorize("hasRole('Admin')")
    // Chỉ admin được phép cập nhật cấu hình thương hiệu của toàn hệ thống.
    public ResponseEntity<BrandingSettingsResponse> updateBrandingSettings(@Valid @RequestBody BrandingSettingsRequest request) {
        return ResponseEntity.ok(brandingSettingsService.updateBrandingSettings(request));
    }
}

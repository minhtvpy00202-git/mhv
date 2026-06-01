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

    public BrandingSettingsController(BrandingSettingsService brandingSettingsService) {
        this.brandingSettingsService = brandingSettingsService;
    }

    @GetMapping
    public ResponseEntity<BrandingSettingsResponse> getBrandingSettings() {
        return ResponseEntity.ok(brandingSettingsService.getBrandingSettings());
    }

    @PutMapping
    @PreAuthorize("hasRole('Admin')")
    public ResponseEntity<BrandingSettingsResponse> updateBrandingSettings(@Valid @RequestBody BrandingSettingsRequest request) {
        return ResponseEntity.ok(brandingSettingsService.updateBrandingSettings(request));
    }
}

package com.poly.mhv.controller;

import com.poly.mhv.dto.asset.AssetCreateRequest;
import com.poly.mhv.dto.asset.AssetResponse;
import com.poly.mhv.dto.asset.AssetUpdateRequest;
import com.poly.mhv.service.AssetService;
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
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetService assetService;

    public AssetController(AssetService assetService) {
        this.assetService = assetService;
    }

    @PostMapping
    public ResponseEntity<AssetResponse> createAsset(@RequestBody AssetCreateRequest request) {
        AssetResponse response = assetService.createAsset(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{qaCode}")
    public ResponseEntity<AssetResponse> updateAsset(
            @PathVariable String qaCode,
            @RequestBody AssetUpdateRequest request
    ) {
        return ResponseEntity.ok(assetService.updateAsset(qaCode, request));
    }

    @DeleteMapping("/{qaCode}")
    public ResponseEntity<Map<String, String>> deleteAsset(@PathVariable String qaCode) {
        assetService.deleteAsset(qaCode);
        return ResponseEntity.ok(Map.of("message", "Xóa thiết bị thành công."));
    }

    @GetMapping
    public ResponseEntity<List<AssetResponse>> getAllAssets(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) Integer locationId
    ) {
        if (name == null && status == null && categoryId == null && locationId == null) {
            return ResponseEntity.ok(assetService.getAllAssets());
        }
        return ResponseEntity.ok(assetService.searchAssets(name, status, categoryId, locationId));
    }

    @GetMapping("/{qaCode}")
    public ResponseEntity<AssetResponse> getAssetByQaCode(@PathVariable String qaCode) {
        return ResponseEntity.ok(assetService.getAssetByQaCode(qaCode));
    }
}

package com.poly.mhv.controller;

import com.poly.mhv.dto.asset.AssetImportPreviewResponse;
import com.poly.mhv.service.AssetImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/assets/import", "/assets/import"})
@Tag(name = "Import tài sản", description = "API nhập tài sản hàng loạt từ Excel")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('Admin')")
public class AssetImportController {

    private final AssetImportService assetImportService;

    public AssetImportController(AssetImportService assetImportService) {
        this.assetImportService = assetImportService;
    }

    @GetMapping("/template")
    @Operation(summary = "Tải file mẫu nhập tài sản", description = "Trả về file Excel mẫu dùng để nhập hàng loạt tài sản.")
    public ResponseEntity<byte[]> downloadTemplate() throws IOException {
        byte[] bytes = assetImportService.generateTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(
                ContentDisposition.attachment().filename("mau-nhap-tai-san.xlsx").build()
        );
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ));
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    @PostMapping("/preview")
    @Operation(summary = "Xem trước nhập tài sản", description = "Kiểm tra và xem trước dữ liệu từ file Excel trước khi nhập.")
    public ResponseEntity<AssetImportPreviewResponse> preview(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return ResponseEntity.ok(assetImportService.previewImport(file));
    }

    @PostMapping("/commit")
    @Operation(summary = "Xác nhận nhập tài sản", description = "Nhập các dòng hợp lệ từ file Excel vào hệ thống.")
    public ResponseEntity<Map<String, Object>> commit(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return ResponseEntity.ok(assetImportService.commitImport(file));
    }
}

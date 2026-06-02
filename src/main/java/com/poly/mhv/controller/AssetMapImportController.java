package com.poly.mhv.controller;

import com.poly.mhv.dto.assetmapimport.MapImportApplyResponse;
import com.poly.mhv.dto.assetmapimport.MapImportApplyRequest;
import com.poly.mhv.dto.assetmapimport.MapImportFloorResponse;
import com.poly.mhv.dto.assetmapimport.MapImportFloorSelectionRequest;
import com.poly.mhv.dto.assetmapimport.MapImportJobDetailResponse;
import com.poly.mhv.dto.assetmapimport.MapImportJobSummaryResponse;
import com.poly.mhv.dto.assetmapimport.MapImportSuggestionResponse;
import com.poly.mhv.dto.assetmapimport.MapImportSuggestionUpdateRequest;
import com.poly.mhv.service.AssetMapImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping({"/api/asset-map-import", "/asset-map-import"})
@Tag(name = "Import ban ve so do", description = "API upload va khoi tao import job cho so do dinh vi tai san")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('Admin')")
public class AssetMapImportController {

    private final AssetMapImportService assetMapImportService;

    public AssetMapImportController(AssetMapImportService assetMapImportService) {
        this.assetMapImportService = assetMapImportService;
    }

    @PostMapping(value = "/jobs", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload ban ve", description = "Tao import job tu file PDF, DWG hoac DXF cho man so do.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Upload ban ve thanh cong"),
            @ApiResponse(responseCode = "400", description = "File khong hop le")
    })
    public ResponseEntity<MapImportJobSummaryResponse> createJob(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                    required = true,
                    content = @Content(
                            mediaType = MediaType.MULTIPART_FORM_DATA_VALUE,
                            schema = @Schema(type = "object")
                    )
            )
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String sourceType
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assetMapImportService.createJob(file, sourceType));
    }

    @GetMapping("/jobs")
    @Operation(summary = "Lay danh sach import job", description = "Tra ve cac lan upload ban ve gan day de admin tiep tuc review.")
    public ResponseEntity<List<MapImportJobSummaryResponse>> getJobs() {
        return ResponseEntity.ok(assetMapImportService.getJobs());
    }

    @GetMapping("/jobs/{jobId}")
    @Operation(summary = "Lay chi tiet import job", description = "Tra ve thong tin job, floors tam va suggestions de review.")
    public ResponseEntity<MapImportJobDetailResponse> getJobDetail(@PathVariable Long jobId) {
        return ResponseEntity.ok(assetMapImportService.getJobDetail(jobId));
    }

    @DeleteMapping("/jobs/{jobId}")
    @Operation(summary = "Xoa import job", description = "Xoa import job va cac tep tam lien quan da upload cho luong import ban ve.")
    public ResponseEntity<Void> deleteJob(@PathVariable Long jobId) {
        assetMapImportService.deleteJob(jobId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/jobs/{jobId}/analyze")
    @Operation(summary = "Tach ban ve con", description = "Tu dong nhan dien cac ban ve con trong file import va gan nhan de admin chon ban can dung.")
    public ResponseEntity<MapImportJobDetailResponse> analyzeJob(@PathVariable Long jobId) {
        return ResponseEntity.ok(assetMapImportService.analyzeJob(jobId));
    }

    @PutMapping("/jobs/{jobId}/floors/{floorId}/selection")
    @Operation(summary = "Chon ban ve con de phan tich", description = "Bat tat trang thai chon mot ban ve con truoc khi parse phong va khu vuc.")
    public ResponseEntity<MapImportFloorResponse> updateFloorSelection(
            @PathVariable Long jobId,
            @PathVariable Long floorId,
            @RequestBody MapImportFloorSelectionRequest request
    ) {
        return ResponseEntity.ok(assetMapImportService.updateFloorSelection(jobId, floorId, request));
    }

    @PostMapping("/jobs/{jobId}/parse-selected")
    @Operation(summary = "Phan tich cac ban da chon", description = "Parse phong va khu vuc tu cac ban ve con da duoc admin chon.")
    public ResponseEntity<MapImportJobDetailResponse> parseSelectedDrawings(@PathVariable Long jobId) {
        return ResponseEntity.ok(assetMapImportService.parseSelectedDrawings(jobId));
    }

    @PutMapping("/jobs/{jobId}/suggestions/{suggestionId}")
    @Operation(summary = "Cap nhat suggestion", description = "Sua ten, loai khu vuc, mau, hasAsset va trang thai duyet cua suggestion.")
    public ResponseEntity<MapImportSuggestionResponse> updateSuggestion(
            @PathVariable Long jobId,
            @PathVariable Long suggestionId,
            @RequestBody MapImportSuggestionUpdateRequest request
    ) {
        return ResponseEntity.ok(assetMapImportService.updateSuggestion(jobId, suggestionId, request));
    }

    @PostMapping("/jobs/{jobId}/suggestions/{suggestionId}/reset")
    @Operation(summary = "Reset suggestion ve parser goc", description = "Khoi phuc lai ten, loai, mau, polygon va trang thai goc cua suggestion tu parser ban dau.")
    public ResponseEntity<MapImportSuggestionResponse> resetSuggestion(
            @PathVariable Long jobId,
            @PathVariable Long suggestionId
    ) {
        return ResponseEntity.ok(assetMapImportService.resetSuggestion(jobId, suggestionId));
    }

    @PostMapping("/jobs/{jobId}/apply")
    @Operation(summary = "Ap dung vao so do that", description = "Tao tang, phong va room shape that tu cac suggestion da duoc duyet.")
    public ResponseEntity<MapImportApplyResponse> applyJob(
            @PathVariable Long jobId,
            @RequestBody(required = false) MapImportApplyRequest request
    ) {
        return ResponseEntity.ok(assetMapImportService.applyJob(jobId, request));
    }
}

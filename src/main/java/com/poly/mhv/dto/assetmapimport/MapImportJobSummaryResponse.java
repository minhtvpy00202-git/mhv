package com.poly.mhv.dto.assetmapimport;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapImportJobSummaryResponse {
    private Long id;
    private String sourceFileName;
    private String sourceFileType;
    private String sourceFileUrl;
    private String status;
    private String errorMessage;
    private String previewFileUrl;
    private Integer pageCount;
    private Integer detectedFloorCount;
    private String rawMetadataJson;
    private String requestedByName;
    private LocalDateTime requestedAt;
    private LocalDateTime updatedAt;
}

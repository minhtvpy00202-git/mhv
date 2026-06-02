package com.poly.mhv.dto.assetmapimport;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapImportApplyResponse {
    private Long jobId;
    private String jobStatus;
    private Integer appliedFloorCount;
    private Integer appliedLocationCount;
    private Integer appliedShapeCount;
    private Integer skippedSuggestionCount;
    private List<String> appliedFloorNames;
    private String message;
}

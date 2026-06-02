package com.poly.mhv.dto.assetmapimport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapImportFloorSelectionRequest {
    private Boolean selectedForAnalysis;
}

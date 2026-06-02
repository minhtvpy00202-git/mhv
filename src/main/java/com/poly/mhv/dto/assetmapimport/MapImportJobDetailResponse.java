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
public class MapImportJobDetailResponse {
    private MapImportJobSummaryResponse job;
    private List<MapImportFloorResponse> floors;
}

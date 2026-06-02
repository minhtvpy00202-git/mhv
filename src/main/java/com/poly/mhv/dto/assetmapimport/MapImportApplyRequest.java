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
public class MapImportApplyRequest {
    private List<MapImportFloorApplyTargetRequest> floorTargets;
}

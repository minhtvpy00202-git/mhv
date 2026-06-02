package com.poly.mhv.dto.assetmapimport;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MapImportFloorApplyTargetRequest {
    private Long importFloorId;
    private Integer targetFloorId;
    private Boolean createNewFloor;
}

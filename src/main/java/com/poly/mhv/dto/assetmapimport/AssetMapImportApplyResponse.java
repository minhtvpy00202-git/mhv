package com.poly.mhv.dto.assetmapimport;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssetMapImportApplyResponse {

    private String message;

    private List<Integer> createdFloorIds;
}

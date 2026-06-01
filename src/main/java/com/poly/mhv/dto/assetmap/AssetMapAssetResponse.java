package com.poly.mhv.dto.assetmap;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetMapAssetResponse {
    private String qaCode;
    private String name;
    private String trackingMode;
    private Integer categoryId;
    private String categoryName;
    private String status;
    private String technicalStatus;
    private String usageStatus;
    private Integer locationId;
    private String locationName;
    private Integer homeLocationId;
    private String homeLocationName;
    private Integer floorId;
    private String floorName;
}

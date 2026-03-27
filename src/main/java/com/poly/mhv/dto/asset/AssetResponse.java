package com.poly.mhv.dto.asset;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetResponse {
    private String qaCode;
    private String name;
    private Integer categoryId;
    private String category;
    private String status;
    private Integer locationId;
    private String locationName;
    private Integer homeLocationId;
    private String homeLocationName;
    private String qrCodeBase64;
}

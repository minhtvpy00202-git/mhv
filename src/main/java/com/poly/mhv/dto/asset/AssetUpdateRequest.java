package com.poly.mhv.dto.asset;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetUpdateRequest {
    private String name;
    private Integer categoryId;
    private Integer locationId;
    private String status;
}

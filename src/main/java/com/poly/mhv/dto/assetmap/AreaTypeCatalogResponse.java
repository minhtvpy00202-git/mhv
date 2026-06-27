package com.poly.mhv.dto.assetmap;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AreaTypeCatalogResponse {
    private Integer id;
    private String typeKey;
    private String label;
    private String areaGroupKey;
    private String areaGroupLabel;
    private String description;
    private Boolean builtIn;
    private Integer sortOrder;
    private Long usageCount;
}

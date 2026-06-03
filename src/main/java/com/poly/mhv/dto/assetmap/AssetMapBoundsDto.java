package com.poly.mhv.dto.assetmap;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetMapBoundsDto {
    private double minX;
    private double minY;
    private double maxX;
    private double maxY;
}

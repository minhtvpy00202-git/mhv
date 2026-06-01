package com.poly.mhv.dto.assetmap;

import com.poly.mhv.dto.category.CategoryOptionResponse;
import com.poly.mhv.dto.location.LocationResponse;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetMapBootstrapResponse {
    private List<MapFloorResponse> floors;
    private List<LocationResponse> locations;
    private List<CategoryOptionResponse> categories;
}

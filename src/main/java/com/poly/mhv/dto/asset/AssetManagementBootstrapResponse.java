package com.poly.mhv.dto.asset;

import com.poly.mhv.dto.category.CategoryOptionResponse;
import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.dto.location.LocationResponse;
import com.poly.mhv.dto.supplier.SupplierResponse;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssetManagementBootstrapResponse {
    private PagedResponse<AssetResponse> assets;
    private List<LocationResponse> locations;
    private List<CategoryOptionResponse> categories;
    private List<SupplierResponse> suppliers;
}

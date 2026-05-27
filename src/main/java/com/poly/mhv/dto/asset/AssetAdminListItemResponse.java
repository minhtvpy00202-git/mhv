package com.poly.mhv.dto.asset;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetAdminListItemResponse {
    private String qaCode;
    private String trackingMode;
    private String name;
    private Integer categoryId;
    private String categoryName;
    private String status;
    private Integer locationId;
    private String locationName;
    private Integer homeLocationId;
    private String homeLocationName;
    private BigDecimal purchasePrice;
    private Integer quantityOnHand;
    private Integer minimumStock;
    private String unit;
    private Integer supplierId;
    private String supplierName;
}

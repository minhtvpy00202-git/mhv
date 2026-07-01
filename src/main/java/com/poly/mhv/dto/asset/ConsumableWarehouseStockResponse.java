package com.poly.mhv.dto.asset;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableWarehouseStockResponse {
    private Integer warehouseLocationId;
    private String warehouseLocationName;
    private String assetQaCode;
    private String assetName;
    private Integer categoryId;
    private String categoryName;
    private Integer quantityRemaining;
    private Integer minimumStock;
    private String unit;
    private String formattedQuantityRemaining;
    private String formattedMinimumStock;
    private BigDecimal averageUnitPrice;
    private BigDecimal inventoryValue;
    private Boolean lowStock;
    private Boolean outOfStock;
    private Boolean expiryTrackingEnabled;
    private LocalDate nearestExpirationDate;
    private Integer activeLotCount;
}

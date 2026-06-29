package com.poly.mhv.dto.asset;

import java.math.BigDecimal;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableWarehouseOverviewResponse {
    private Integer warehouseLocationId;
    private String warehouseLocationName;
    private Integer warehouseCount;
    private Integer stockRowCount;
    private Integer lowStockCount;
    private Integer outOfStockCount;
    private BigDecimal totalInventoryValue;
    private List<ConsumableWarehouseStockResponse> stocks;
    private List<ConsumableWarehouseTransferResponse> transferHistory;
}

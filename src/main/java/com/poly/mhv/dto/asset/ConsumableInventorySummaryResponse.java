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
public class ConsumableInventorySummaryResponse {
    private long totalConsumables;
    private long healthyConsumables;
    private long lowStockConsumables;
    private long expiredLots;
    private BigDecimal totalInventoryValue;
}

package com.poly.mhv.dto.statistics;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetStatisticsSummaryResponse {
    private long fixedAssetCount;
    private long consumableCount;
    private long availableAssetCount;
    private long borrowedAssetCount;
    private long brokenAssetCount;
    private long repairingAssetCount;
    private long lostAssetCount;
    private long lowStockConsumableCount;
    private long expiredLotCount;
    private long expiringSoonLotCount;
    private long pendingConsumableRequestCount;
    private long pendingDisposalRequestCount;
    private long borrowEventCount;
    private long ticketCount;
    private long auditCount;
    private long auditMissingCount;
    private BigDecimal fixedAssetValue;
    private BigDecimal consumableInventoryValue;
}

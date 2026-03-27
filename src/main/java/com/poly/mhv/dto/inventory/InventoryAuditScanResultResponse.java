package com.poly.mhv.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryAuditScanResultResponse {
    private Integer auditId;
    private String assetQaCode;
    private String assetName;
    private Integer scannedCount;
    private Integer expectedCount;
}

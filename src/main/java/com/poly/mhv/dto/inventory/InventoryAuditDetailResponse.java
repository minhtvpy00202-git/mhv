package com.poly.mhv.dto.inventory;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryAuditDetailResponse {
    private InventoryAuditSummaryResponse summary;
    private List<InventoryAuditItemResponse> scannedItems;
    private List<InventoryAuditMissingResponse> missingItems;
}

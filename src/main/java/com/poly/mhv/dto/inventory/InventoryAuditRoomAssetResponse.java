package com.poly.mhv.dto.inventory;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryAuditRoomAssetResponse {
    private String assetQaCode;
    private String assetName;
    private String homeLocationName;
    private String currentLocationName;
    private String borrowerName;
    private String fromLocationName;
    private String toLocationName;
    private LocalDateTime borrowedAt;
    private String technicalStatus;
    private String displayStatus;
}

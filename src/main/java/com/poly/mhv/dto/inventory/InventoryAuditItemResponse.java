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
public class InventoryAuditItemResponse {
    private String assetQaCode;
    private String assetName;
    private String scannedByUsername;
    private LocalDateTime scannedAt;
}

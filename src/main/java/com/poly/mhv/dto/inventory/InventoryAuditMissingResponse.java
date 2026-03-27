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
public class InventoryAuditMissingResponse {
    private String assetQaCode;
    private String assetName;
    private String locationName;
    private String resolutionStatus;
    private String resolvedByUsername;
    private LocalDateTime resolvedAt;
}

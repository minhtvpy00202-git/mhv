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
public class InventoryAuditSummaryResponse {
    private Integer id;
    private Integer locationId;
    private String locationName;
    private String createdByUsername;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private String status;
    private Integer expectedCount;
    private Integer scannedCount;
    private Integer missingCount;
    private String notes;
}

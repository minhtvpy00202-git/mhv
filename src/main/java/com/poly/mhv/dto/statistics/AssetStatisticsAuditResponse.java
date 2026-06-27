package com.poly.mhv.dto.statistics;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetStatisticsAuditResponse {
    private Integer id;
    private String locationName;
    private String status;
    private int expectedCount;
    private int scannedCount;
    private int missingCount;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
}

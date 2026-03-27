package com.poly.mhv.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardSummaryResponse {
    private long totalAssets;
    private long inUseAssets;
    private long brokenAssets;
    private long maintenanceAssets;
    private long availableAssets;
}

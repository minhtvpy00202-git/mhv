package com.poly.mhv.dto.asset;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumableLocationOverviewResponse {
    private Integer locationId;
    private String locationName;
    private List<ConsumableLocationStockResponse> stocks;
    private List<ConsumableIssueResponse> issueHistory;
    private List<ConsumableRequestResponse> requestHistory;
}

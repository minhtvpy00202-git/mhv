package com.poly.mhv.dto.dashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminDashboardBootstrapResponse {
    private DashboardSummaryResponse summary;
    private SmartSuggestionResponse smartSuggestions;
    private HelpdeskKpiResponse helpdeskKpis;
}

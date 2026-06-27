package com.poly.mhv.dto.statistics;

import java.time.LocalDate;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetStatisticsResponse {
    private LocalDate fromDate;
    private LocalDate toDate;
    private Integer categoryId;
    private Integer locationId;
    private AssetStatisticsSummaryResponse summary;
    private List<AssetStatisticsCountResponse> fixedAssetStatus;
    private List<AssetStatisticsCountResponse> fixedAssetUsage;
    private List<AssetStatisticsCountResponse> fixedAssetsByCategory;
    private List<AssetStatisticsCountResponse> fixedAssetsByLocation;
    private List<AssetStatisticsCountResponse> consumablesByCategory;
    private List<AssetStatisticsCountResponse> consumableStockStatus;
    private List<AssetStatisticsCountResponse> expiryBuckets;
    private List<AssetStatisticsTrendResponse> borrowTrend;
    private List<AssetStatisticsTrendResponse> ticketTrend;
    private List<AssetStatisticsTrendResponse> issuanceTrend;
    private List<AssetStatisticsCountResponse> ticketStatus;
    private List<AssetStatisticsCountResponse> auditStatus;
    private List<AssetStatisticsRankResponse> topBorrowedAssets;
    private List<AssetStatisticsRankResponse> topProblemAssets;
    private List<AssetStatisticsRankResponse> topLowStockConsumables;
    private List<AssetStatisticsRankResponse> topBorrowedUsers;
    private List<AssetStatisticsRankResponse> topBorrowedLocations;
    private List<AssetStatisticsRankResponse> topDispensedConsumables;
    private List<AssetStatisticsAuditResponse> recentAudits;
}

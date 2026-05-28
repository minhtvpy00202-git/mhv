package com.poly.mhv.service;

import com.poly.mhv.dto.dashboard.AdminDashboardBootstrapResponse;
import com.poly.mhv.dto.dashboard.DashboardSummaryResponse;
import com.poly.mhv.dto.dashboard.HelpdeskKpiResponse;
import com.poly.mhv.dto.dashboard.SmartSuggestionResponse;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.TicketRepository;
import com.poly.mhv.repository.UsageHistoryRepository;
import com.poly.mhv.util.AssetStatusSupport;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private static final long DASHBOARD_CACHE_TTL_MS = 30_000L;

    private final AssetRepository assetRepository;
    private final TicketRepository ticketRepository;
    private final UsageHistoryRepository usageHistoryRepository;
    private volatile DashboardSummaryResponse cachedSummary;
    private volatile long cachedSummaryExpiresAt;
    private volatile SmartSuggestionResponse cachedSuggestions;
    private volatile long cachedSuggestionsExpiresAt;

    public DashboardService(
            AssetRepository assetRepository,
            TicketRepository ticketRepository,
            UsageHistoryRepository usageHistoryRepository
    ) {
        this.assetRepository = assetRepository;
        this.ticketRepository = ticketRepository;
        this.usageHistoryRepository = usageHistoryRepository;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary() {
        long now = System.currentTimeMillis();
        DashboardSummaryResponse cacheSnapshot = cachedSummary;
        if (cacheSnapshot != null && cachedSummaryExpiresAt > now) {
            return cacheSnapshot;
        }
        DashboardSummaryResponse response = DashboardSummaryResponse.builder()
                .totalAssets(assetRepository.countAllAssets())
                .inUseAssets(assetRepository.countBorrowedAssets(
                        AssetStatusSupport.TECHNICAL_STATUS_GOOD,
                        AssetStatusSupport.USAGE_STATUS_BORROWED
                ))
                .brokenAssets(assetRepository.countBrokenAssets(AssetStatusSupport.TECHNICAL_STATUS_BROKEN))
                .maintenanceAssets(assetRepository.countRepairingAssets(AssetStatusSupport.TECHNICAL_STATUS_BROKEN))
                .availableAssets(assetRepository.countAvailableAssets(
                        AssetStatusSupport.TECHNICAL_STATUS_GOOD,
                        AssetStatusSupport.USAGE_STATUS_HOME
                ))
                .build();
        cachedSummary = response;
        cachedSummaryExpiresAt = now + DASHBOARD_CACHE_TTL_MS;
        return response;
    }

    public void invalidateSummaryCache() {
        cachedSummary = null;
        cachedSummaryExpiresAt = 0L;
    }

    @Transactional(readOnly = true)
    public SmartSuggestionResponse getSmartSuggestions() {
        long now = System.currentTimeMillis();
        SmartSuggestionResponse cacheSnapshot = cachedSuggestions;
        if (cacheSnapshot != null && cachedSuggestionsExpiresAt > now) {
            return cacheSnapshot;
        }
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay().minusNanos(1);

        Map<String, Long> usageCountMap = new HashMap<>();
        for (Object[] row : usageHistoryRepository.countUsageByAssetInPeriod(start, end)) {
            String qaCode = String.valueOf(row[0]);
            Long count = ((Number) row[1]).longValue();
            usageCountMap.put(qaCode, count);
        }


        List<String> suggestions = ticketRepository.getTicketStatsInPeriod(start, end).stream()
                .limit(5)
                .map(row -> {
                    String qaCode = String.valueOf(row[0]);
                    String assetName = String.valueOf(row[1]);
                    String roomName = String.valueOf(row[2]);
                    Long breakdownCount = ((Number) row[3]).longValue();
                    Long usageCount = usageCountMap.getOrDefault(qaCode, 0L);
                    if (breakdownCount >= 3) {
                        return "Thiết bị " + qaCode + " (" + assetName + ") đã báo hỏng " + breakdownCount
                                + " lần trong tháng này tại phòng " + roomName
                                + ". Đề xuất: Thanh lý và mua mới.";
                    }
                    if (breakdownCount >= 2 || usageCount >= 30) {
                        return "Thiết bị " + qaCode + " (" + assetName + ") có dấu hiệu quá tải ("
                                + breakdownCount + " lần báo hỏng, " + usageCount
                                + " lượt mượn tháng này). Đề xuất: Bảo trì chuyên sâu.";
                    }
                    return "Thiết bị " + qaCode + " (" + assetName + ") có " + breakdownCount
                            + " báo hỏng trong tháng này. Đề xuất: Theo dõi định kỳ.";
                })
                .toList();

        if (suggestions.isEmpty()) {
            suggestions = List.of("Chưa có thiết bị nào vượt ngưỡng cảnh báo trong tháng này.");
        }

        SmartSuggestionResponse response = SmartSuggestionResponse.builder()
                .suggestions(suggestions)
                .build();
        cachedSuggestions = response;
        cachedSuggestionsExpiresAt = now + DASHBOARD_CACHE_TTL_MS;
        return response;
    }

    @Transactional(readOnly = true)
    public AdminDashboardBootstrapResponse getAdminBootstrap(HelpdeskKpiResponse helpdeskKpis) {
        return AdminDashboardBootstrapResponse.builder()
                .summary(getSummary())
                .smartSuggestions(getSmartSuggestions())
                .helpdeskKpis(helpdeskKpis)
                .build();
    }
}

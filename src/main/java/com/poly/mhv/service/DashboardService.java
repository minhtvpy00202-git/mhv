package com.poly.mhv.service;

import com.poly.mhv.dto.dashboard.DashboardSummaryResponse;
import com.poly.mhv.dto.dashboard.SmartSuggestionResponse;
import com.poly.mhv.repository.AssetRepository;
import com.poly.mhv.repository.MaintenanceRequestRepository;
import com.poly.mhv.repository.UsageHistoryRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private final AssetRepository assetRepository;
    private final MaintenanceRequestRepository maintenanceRequestRepository;
    private final UsageHistoryRepository usageHistoryRepository;

    public DashboardService(
            AssetRepository assetRepository,
            MaintenanceRequestRepository maintenanceRequestRepository,
            UsageHistoryRepository usageHistoryRepository
    ) {
        this.assetRepository = assetRepository;
        this.maintenanceRequestRepository = maintenanceRequestRepository;
        this.usageHistoryRepository = usageHistoryRepository;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary() {
        return DashboardSummaryResponse.builder()
                .totalAssets(assetRepository.countAllAssets())
                .inUseAssets(assetRepository.countByStatusValue("Đang sử dụng"))
                .brokenAssets(assetRepository.countByStatusValue("Hỏng"))
                .maintenanceAssets(assetRepository.countByStatusValue("Bảo trì"))
                .availableAssets(assetRepository.countByStatusValue("Sẵn sàng"))
                .build();
    }

    @Transactional(readOnly = true)
    public SmartSuggestionResponse getSmartSuggestions() {
        LocalDate today = LocalDate.now();
        LocalDateTime start = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime end = today.plusDays(1).atStartOfDay().minusNanos(1);

        Map<String, Long> usageCountMap = new HashMap<>();
        for (Object[] row : usageHistoryRepository.countUsageByAssetInPeriod(start, end)) {
            String qaCode = String.valueOf(row[0]);
            Long count = ((Number) row[1]).longValue();
            usageCountMap.put(qaCode, count);
        }

        List<String> suggestions = maintenanceRequestRepository.getMaintenanceStatsInPeriod(start, end).stream()
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

        return SmartSuggestionResponse.builder()
                .suggestions(suggestions)
                .build();
    }
}

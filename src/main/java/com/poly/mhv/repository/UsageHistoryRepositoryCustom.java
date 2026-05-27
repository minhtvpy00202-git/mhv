package com.poly.mhv.repository;

import com.poly.mhv.entity.UsageHistory;
import java.time.LocalDateTime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UsageHistoryRepositoryCustom {
    Page<UsageHistory> searchForAdminDynamic(
            String assetName,
            Integer borrowedLocationId,
            Integer userId,
            LocalDateTime startDateTime,
            LocalDateTime endDateTime,
            Pageable pageable
    );
}

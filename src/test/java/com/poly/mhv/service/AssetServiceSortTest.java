package com.poly.mhv.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.query.QueryUtils;

class AssetServiceSortTest {

    @Test
    void createdAtSortUsesAssetCreateNotificationTimeBeforePagination() {
        Sort sort = AssetService.buildSort("createdAt", "desc");
        List<Sort.Order> orders = sort.stream().toList();

        assertEquals(3, orders.size());
        assertEquals(Sort.Direction.ASC, orders.get(0).getDirection());
        assertTrue(orders.get(0).getProperty().contains("ASSET_CREATE"));
        assertEquals(Sort.Direction.DESC, orders.get(1).getDirection());
        assertTrue(orders.get(1).getProperty().contains("occurredAt"));
        assertEquals("qaCode", orders.get(2).getProperty());

        String sortedQuery = QueryUtils.applySorting("select a from Asset a", sort, "a");
        assertTrue(sortedQuery.contains("from Notification assetCreateNotification"));
        assertTrue(sortedQuery.contains("assetCreateNotification.assetQaCode = a.qaCode"));
    }

    @Test
    void createdAtAscendingStillKeepsAssetsWithoutCreationNotificationLast() {
        List<Sort.Order> orders = AssetService.buildSort("createdAt", "asc").stream().toList();

        assertEquals(Sort.Direction.ASC, orders.get(0).getDirection());
        assertEquals(Sort.Direction.ASC, orders.get(1).getDirection());
        assertTrue(orders.get(0).getProperty().startsWith("case when"));
    }
}

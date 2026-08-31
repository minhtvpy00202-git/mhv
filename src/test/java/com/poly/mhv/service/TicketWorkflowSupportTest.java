package com.poly.mhv.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.poly.mhv.entity.Asset;
import com.poly.mhv.util.TicketStatusSupport;
import org.junit.jupiter.api.Test;

class TicketWorkflowSupportTest {

    @Test
    void awaitingReporterConfirmationIsStillAnActiveTicketForKpi() {
        assertTrue(HelpdeskKpiService.isActiveTicketStatus(TicketStatusSupport.AWAITING_CONFIRMATION));
    }

    @Test
    void usageOnlyUpdatePreservesRepairInProgressState() {
        Asset asset = Asset.builder().status("Bảo trì").build();
        assertTrue(AssetService.shouldPreserveRepairStatus(asset));
        assertFalse(AssetService.shouldPreserveRepairStatus(Asset.builder().status("Hỏng").build()));
    }
}

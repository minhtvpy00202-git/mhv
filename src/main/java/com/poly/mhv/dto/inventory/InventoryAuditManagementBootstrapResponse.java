package com.poly.mhv.dto.inventory;

import com.poly.mhv.dto.common.PagedResponse;
import com.poly.mhv.dto.location.LocationResponse;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryAuditManagementBootstrapResponse {
    private PagedResponse<InventoryAuditSummaryResponse> audits;
    private List<LocationResponse> locations;
}

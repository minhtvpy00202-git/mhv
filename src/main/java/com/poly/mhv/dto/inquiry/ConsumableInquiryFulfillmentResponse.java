package com.poly.mhv.dto.inquiry;

import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsumableInquiryFulfillmentResponse {
    private Long id;
    private Long inquiryId;
    private Long originalConsumableRequestId;
    private Long activeConsumableRequestId;
    private Integer sourceWarehouseLocationId;
    private String sourceWarehouseLocationName;
    private Integer requestedQuantity;
    private Integer fulfilledQuantity;
    private Integer remainingQuantity;
    private Integer preparedQuantity;
    private String status;
    private Boolean requiresAdminApproval;
    private Boolean adminApproved;
    private Integer adminApprovedByUserId;
    private String adminApprovedByName;
    private Integer preparedByUserId;
    private String preparedByName;
    private Boolean closedPartial;
    private String decisionNote;
    private OffsetDateTime createdAt;
    private OffsetDateTime adminApprovedAt;
    private OffsetDateTime preparedAt;
    private OffsetDateTime readyAt;
    private OffsetDateTime fulfilledAt;
    private OffsetDateTime updatedAt;
}

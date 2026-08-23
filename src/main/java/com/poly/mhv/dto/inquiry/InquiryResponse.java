package com.poly.mhv.dto.inquiry;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryResponse {
    private Long id;
    private String inquiryType;
    private String targetRole;
    private String status;
    private Integer requesterId;
    private String requesterName;
    private Integer assigneeId;
    private String assigneeName;
    private String assetQaCode;
    private String assetName;
    private String trackingMode;
    private String assetStatus;
    private String assetTechnicalStatus;
    private String assetUsageStatus;
    private Integer availableQuantity;
    private String unit;
    private Integer quantityRequested;
    private Integer destinationLocationId;
    private String destinationLocationName;
    private LocalDate neededFrom;
    private LocalDate expectedReturnDate;
    private String purpose;
    private String alternativeAssetQaCode;
    private String alternativeAssetName;
    private Integer proposedQuantity;
    private Boolean alternativeAccepted;
    private String decisionNote;
    private String linkedEntityType;
    private Long linkedEntityId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime claimedAt;
    private OffsetDateTime completedAt;
    private OffsetDateTime receivedAt;
    private OffsetDateTime slaResponseDueAt;
    private OffsetDateTime firstResponseAt;
    private OffsetDateTime slaBreachedAt;
    private Integer overdueReminderCount;
    private Long unreadCount;
}
